import { Router } from "express";
import { db, invoicesTable, studentsTable } from "@workspace/db";
import { eq, and, like } from "drizzle-orm";
import { format } from "date-fns";
import PDFDocument from "pdfkit";
import ejs from "ejs";
import path from "path";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import SibApiV3Sdk from "sib-api-v3-sdk";
import { uploadPdfToSupabase } from "../lib/supabase-storage.js";

// Resolve __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Runtime path for the EJS template (copied to dist/templates/ by build.mjs)
const TEMPLATE_PATH = path.resolve(__dirname, "templates/fee_invoice.ejs");

// Extract the logo data URI from fee_invoice.html (3 levels up from dist/ → app_manager/)
let LOGO_BASE64 = "";
try {
  const originalHtml = readFileSync(
    path.resolve(__dirname, "../../../fee_invoice.html"),
    "utf-8",
  );
  const match = originalHtml.match(/data:image\/jpeg;base64,[^"]+/);
  if (match) LOGO_BASE64 = match[0];
} catch {
  // logo not found – template will render without logo image
}

const router = Router();
const FIXED_STUDENT_FEE_PKR = 2000;
const ADMIN_EMAILS = ["admin@iiecs.edu", "teacher@iiecs.edu"];

async function generateInvoiceNumber(studentId: string): Promise<string> {
  const now = new Date();
  const prefix = `INV-${format(now, "yyyyMM")}`;
  // Find the highest existing invoice number with this prefix
  const existing = await db
    .select()
    .from(invoicesTable)
    .where(like(invoicesTable.invoiceNumber, `${prefix}%`));
  let maxNumber = 0;
  for (const inv of existing) {
    const parts = inv.invoiceNumber.split('-');
    const seq = parseInt(parts[parts.length - 1]);
    if (!isNaN(seq) && seq > maxNumber) {
      maxNumber = seq;
    }
  }
  const nextNumber = (maxNumber + 1).toString().padStart(4, "0");
  return `${prefix}-${nextNumber}`;
}

async function getAuthContext(req: {
  headers: Record<string, unknown>;
}): Promise<{ role: "admin" | "student"; email: string; studentId: string | null } | null> {
  const raw = req.headers["x-user-email"];
  const email = typeof raw === "string" ? raw.toLowerCase().trim() : null;
  if (!email) return null;

  if (ADMIN_EMAILS.includes(email)) {
    return { role: "admin", email, studentId: null };
  }

  const [student] = await db
    .select({ id: studentsTable.id })
    .from(studentsTable)
    .where(eq(studentsTable.email, email))
    .limit(1);

  if (!student) return null;
  return { role: "student", email, studentId: student.id };
}

export async function buildInvoicePdfBuffer(input: {
  invoiceNumber: string;
  issuedDate: Date;
  dueDate: string | null;
  status: string;
  amountPkr: number;
  student: { fullName: string; idNumber: string; batch: string; email: string };
}): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    // Compact page – fits all content in ~210pt height, far less than A4's 842pt
    const doc = new PDFDocument({ size: "A4", margin: 0, autoFirstPage: true });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W = doc.page.width;   // 595
    const H = doc.page.height;  // 842

    // ── HEADER (0..70) ──────────────────────────────────────────────────────
    const headerH = 70;
    doc.rect(0, 0, W, headerH).fill("#1e3c72");

    // Logo
    if (LOGO_BASE64) {
      const base64Data = LOGO_BASE64.split(",")[1];
      if (base64Data) {
        const logoBuf = Buffer.from(base64Data, "base64");
        try { doc.image(logoBuf, 14, 10, { width: 48, height: 48 }); } catch { /* ignore */ }
      }
    }

    // Brand
    doc.fillColor("white").font("Helvetica-Bold").fontSize(15)
      .text("UPRISER: INSTITUTE OF TECHNOLOGY", 72, 18, { lineBreak: false });
    doc.fillColor("white").font("Helvetica-Oblique").fontSize(9)
      .text("Education and Beyond...", 72, 37, { lineBreak: false });

    // Invoice meta (right-aligned)
    const metaLines = [
      `Fee Invoice`,
      `No: ${input.invoiceNumber}`,
      `Date: ${format(input.issuedDate, "yyyy-MM-dd")}`,
      `Due: ${input.dueDate ?? "Upon receipt"}`,
    ];
    const metaRightX = W - 20;
    metaLines.forEach((line, i) => {
      const isBold = i === 0;
      doc.fillColor("white")
        .font(isBold ? "Helvetica-Bold" : "Helvetica")
        .fontSize(isBold ? 12 : 9)
        .text(line, 0, 10 + i * 14, { width: metaRightX, align: "right", lineBreak: false });
    });

    // ── BODY (starts at 80) ──────────────────────────────────────────────────
    const bodyY = headerH + 10;
    // Left column: 20..282  Right column: 297..577  gap=15
    const leftColW = 262;
    const rightColW = 280;
    const leftX = 20;
    const rightX = 297;
    // Amount column inside right column: last 70pt for numbers
    const amtW = 70;
    const descW = rightColW - amtW - 8;

    // Section title helper
    const sectionTitle = (label: string, x: number, y: number, colWidth: number) => {
      doc.fillColor("#1e3c72").font("Helvetica-Bold").fontSize(11)
        .text(label.toUpperCase(), x, y, { width: colWidth, lineBreak: false });
      doc.moveTo(x, y + 14).lineTo(x + colWidth, y + 14)
        .lineWidth(1.5).strokeColor("#2a5298").stroke();
    };

    // Row helper – label and value on same absolute Y, value uses smaller font if needed
    const infoRow = (label: string, value: string, x: number, y: number, colWidth: number) => {
      const labelW = 48;
      const valW = colWidth - labelW - 4;
      doc.fillColor("#444").font("Helvetica-Bold").fontSize(10)
        .text(label, x, y, { width: labelW, lineBreak: false });
      // Use smaller font for email to prevent wrap
      const isEmail = value.includes("@");
      doc.fillColor("#555").font("Helvetica").fontSize(isEmail ? 8.5 : 10)
        .text(value, x + labelW + 4, isEmail ? y + 1 : y,
          { width: valW, lineBreak: false, ellipsis: true });
    };

    // ── Student Details (left) ───────────────────────────────────────────────
    sectionTitle("Student Details", leftX, bodyY, leftColW);

    const rowH = 17;
    const rows = [
      { label: "Name:", value: input.student.fullName },
      { label: "ID:", value: input.student.idNumber },
      { label: "Batch:", value: input.student.batch },
      { label: "Email:", value: input.student.email },
      { label: "Status:", value: input.status },
    ];
    rows.forEach((row, i) => {
      infoRow(row.label, row.value, leftX, bodyY + 20 + i * rowH, leftColW);
    });

    // ── Fee Breakdown (right) ─────────────────────────────────────────────────
    sectionTitle("Fee Breakdown", rightX, bodyY, rightColW);

    // Fee item row – description uses descW, amount right-aligned in last amtW
    const feeItemY = bodyY + 20;
    // Shorten desc to "Course Fee" + batch to keep it within descW
    const feeDesc = `Course Fee – C/C++ Algorithms`;
    const feeAmt = `Rs ${input.amountPkr.toLocaleString("en-PK")}`;
    doc.fillColor("#333").font("Helvetica").fontSize(9.5)
      .text(feeDesc, rightX, feeItemY + 0.5, { width: descW, lineBreak: false, ellipsis: true });
    doc.fillColor("#1e3c72").font("Helvetica-Bold").fontSize(10)
      .text(feeAmt, rightX + descW + 8, feeItemY, { width: amtW, align: "right", lineBreak: false });

    // Dotted separator
    const sepY = feeItemY + 15;
    doc.moveTo(rightX, sepY).lineTo(rightX + rightColW, sepY)
      .lineWidth(0.5).dash(2, { space: 3 }).strokeColor("#ccc").stroke();
    doc.undash();

    // Total Amount Due row – solid top border in #1e3c72
    const totalY = sepY + 5;
    doc.moveTo(rightX, totalY).lineTo(rightX + rightColW, totalY)
      .lineWidth(2).strokeColor("#1e3c72").stroke();
    doc.fillColor("#1e3c72").font("Helvetica-Bold").fontSize(11)
      .text("Total Amount Due", rightX, totalY + 4, { width: descW, lineBreak: false });
    doc.fillColor("#1e3c72").font("Helvetica-Bold").fontSize(11)
      .text(`Rs ${input.amountPkr.toLocaleString("en-PK")} /-`,
        rightX + descW + 8, totalY + 4, { width: amtW, align: "right", lineBreak: false });

    // ── FOOTER – placed just below the taller of the two columns ─────────────
    // bodyY=80, 5 rows × 17 = 85 → last row bottom = 80+20+4×17 = 168
    // totalY ≈ 80+20+15+5 = 120  → totalY+4+14 = 138
    // footerY safely = max of both + padding, capped well below page bottom
    const leftColBottom = bodyY + 20 + (rows.length - 1) * rowH + 14;
    const rightColBottom = totalY + 18;
    const footerY = Math.max(leftColBottom, rightColBottom) + 20;

    doc.rect(0, footerY, W, 20).fill("#f8f9fa");
    doc.moveTo(0, footerY).lineTo(W, footerY)
      .lineWidth(0.5).strokeColor("#ddd").stroke();
    doc.fillColor("#666").font("Helvetica").fontSize(8)
      .text(
        "Thank you for your enrollment with UPRISER: INSTITUTE OF TECHNOLOGY  |  For inquiries: admin@iiecs.edu",
        0, footerY + 6, { width: W, align: "center", lineBreak: false }
      );

    doc.end();
  });
}

const PORTAL_URL = "https://iiecs-api-server-attendance-app.vercel.app/";

async function sendInvoiceEmail(input: {
  toEmail: string;
  toName: string;
  invoiceNumber: string;
  pdfFileName: string;
  pdfBuffer: Buffer;
  portalUrl?: string;
}) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.error("BREVO_API_KEY is not configured");
    return;
  }

  // Initialize Brevo API client
  const defaultClient = SibApiV3Sdk.ApiClient.instance;
  const apiKeyAuth = defaultClient.authentications["api-key"];
  apiKeyAuth.apiKey = apiKey;

  const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

  const senderEmail = process.env.BREVO_SENDER_EMAIL ?? "noreply@iiecs.edu";
  const senderName = process.env.BREVO_SENDER_NAME ?? "IIECS Admin";

  // Log environment info for debugging IP changes
  console.log(`[InvoiceEmail] Environment: ${process.env.NODE_ENV || 'unknown'}`);
  console.log(`[InvoiceEmail] Sender: ${senderEmail}`);
  console.log(`[InvoiceEmail] Target: ${input.toEmail}`);

  const portalSection = input.portalUrl
    ? `<p style="margin-top:16px;padding:14px 18px;background:#f0f4ff;border-left:4px solid #1e3c72;border-radius:4px;">
        <strong>🎓 Student Portal Access</strong><br/>
        You can access your student portal, view attendance records, download invoices, and manage your profile at:<br/>
        <a href="${input.portalUrl}" style="color:#1e3c72;font-weight:600;">${input.portalUrl}</a>
       </p>`
    : "";

  const htmlContent = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333;">
      <div style="background:#1e3c72;padding:20px 24px;border-radius:8px 8px 0 0;">
        <h2 style="color:#fff;margin:0;font-size:18px;">UPRISER: INSTITUTE OF TECHNOLOGY</h2>
        <p style="color:#a8bfe0;margin:4px 0 0;font-size:12px;">Education and Beyond...</p>
      </div>
      <div style="padding:24px;border:1px solid #dde3f0;border-top:none;border-radius:0 0 8px 8px;">
        <p>Dear <strong>${input.toName}</strong>,</p>
        <p>Please find attached your fee invoice <strong>${input.invoiceNumber}</strong> for your records.</p>
        ${portalSection}
        <p style="margin-top:20px;font-size:13px;color:#666;">
          For any queries, please contact us at <a href="mailto:admin@iiecs.edu" style="color:#1e3c72;">admin@iiecs.edu</a>.
        </p>
        <p style="margin-top:4px;font-size:13px;">Regards,<br/><strong>${senderName}</strong></p>
      </div>
      <p style="font-size:11px;color:#aaa;text-align:center;margin-top:12px;">
        UPRISER: INSTITUTE OF TECHNOLOGY &nbsp;|&nbsp; admin@iiecs.edu
      </p>
    </div>`;

  const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
  sendSmtpEmail.subject = `Fee Invoice ${input.invoiceNumber} – UPRISER Institute`;
  sendSmtpEmail.htmlContent = htmlContent;
  sendSmtpEmail.sender = { email: senderEmail, name: senderName };
  sendSmtpEmail.to = [{ email: input.toEmail, name: input.toName }];
  
  // Add attachment
  if (input.pdfBuffer) {
    sendSmtpEmail.attachment = [
      {
        name: input.pdfFileName,
        content: input.pdfBuffer.toString("base64"),
      },
    ];
  }

  try {
    console.log(`[InvoiceEmail] Attempting to send invoice ${input.invoiceNumber} to ${input.toEmail}`);
    const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log(`[InvoiceEmail] Successfully sent invoice ${input.invoiceNumber}, Message ID: ${data.messageId}`);
    return data;
  } catch (error: any) {
    console.error(`[InvoiceEmail] Failed to send invoice ${input.invoiceNumber} to ${input.toEmail}:`);
    if (error.response && error.response.body) {
      console.error("Brevo API Error:", error.response.body);
      // Handle specific IP-related errors
      if (error.response.body.message && error.response.body.message.includes('IP')) {
        console.error("IP address related error detected. This may be due to Vercel's dynamic IP routing.");
      }
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      console.error("Network connection error - this could be related to IP routing issues.");
    }
    throw new Error(`Brevo SMTP API error: ${error.message || "Unknown error"}`);
  }
}

async function uploadInvoicePdfAndSave(params: {
  invoiceId: string;
  invoiceNumber: string;
  pdfBuffer: Buffer;
}) {
  const pdfUrl = await uploadPdfToSupabase({
    bucketName: "invoices",
    objectPath: `invoices/${params.invoiceNumber}.pdf`,
    buffer: params.pdfBuffer,
  });

  const [updated] = await db
    .update(invoicesTable)
    .set({ pdfUrl })
    .where(eq(invoicesTable.id, params.invoiceId))
    .returning({ id: invoicesTable.id, pdfUrl: invoicesTable.pdfUrl });

  return updated?.pdfUrl ?? pdfUrl;
}

function buildInvoiceCardPageBuffer(invoices: Array<{
  invoiceNumber: string;
  issuedDate: Date;
  dueDate: string | null;
  status: string;
  amountPkr: number;
  student: { fullName: string; idNumber: string; batch: string; email: string };
}>) {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 18, autoFirstPage: true });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageW = doc.page.width;
    const pageH = doc.page.height;
    const cardGap = 10;
    const topMargin = 18;
    const bottomMargin = 18;
    const leftMargin = 18;
    const cardHeight = Math.floor((pageH - topMargin - bottomMargin - cardGap * 2) / 3);
    const cardWidth = pageW - leftMargin * 2;

    function drawCard(invoice: (typeof invoices)[number], indexOnPage: number) {
      const y = topMargin + indexOnPage * (cardHeight + cardGap);
      const cardX = leftMargin;
      const cardY = y;
      const innerPad = 14;
      const headerH = 36;

      doc.roundedRect(cardX, cardY, cardWidth, cardHeight, 10).fillAndStroke("#ffffff", "#d7deea");
      doc.roundedRect(cardX, cardY, cardWidth, headerH, 10).fill("#1e3c72");
      doc.rect(cardX, cardY + headerH - 10, cardWidth, 10).fill("#1e3c72");

      doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(12)
        .text("UPRISER: INSTITUTE OF TECHNOLOGY", cardX + innerPad, cardY + 10, { width: cardWidth - innerPad * 2, lineBreak: false });
      doc.fillColor("#a8bfe0").font("Helvetica").fontSize(8)
        .text("Monthly Fee Invoice", cardX + innerPad, cardY + 23, { width: cardWidth - innerPad * 2, lineBreak: false });

      const leftX = cardX + innerPad;
      const rightX = cardX + cardWidth - innerPad - 170;
      const bodyTop = cardY + headerH + 12;
      const labelStyle = { width: 52, lineBreak: false } as const;
      const valueW = 162;

      const row = (label: string, value: string, rowIndex: number, bold = false) => {
        const yy = bodyTop + rowIndex * 18;
        doc.fillColor("#4a4f58").font("Helvetica-Bold").fontSize(9).text(label, leftX, yy, labelStyle);
        doc.fillColor("#111827").font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(label === "Email:" ? 7.5 : 9)
          .text(value, leftX + 56, yy, { width: valueW, lineBreak: false, ellipsis: true });
      };

      row("Name:", invoice.student.fullName, 0, true);
      row("ID:", invoice.student.idNumber, 1);
      row("Batch:", invoice.student.batch, 2);
      row("Email:", invoice.student.email, 3);
      row("Status:", invoice.status, 4);

      doc.fillColor("#1e3c72").font("Helvetica-Bold").fontSize(10)
        .text(`Invoice # ${invoice.invoiceNumber}`, rightX, bodyTop, { width: 160, align: "right", lineBreak: false });
      doc.fillColor("#4a4f58").font("Helvetica").fontSize(8)
        .text(`Issued: ${format(invoice.issuedDate, "yyyy-MM-dd")}`, rightX, bodyTop + 18, { width: 160, align: "right", lineBreak: false });
      doc.fillColor("#4a4f58").font("Helvetica").fontSize(8)
        .text(`Due: ${invoice.dueDate ?? "Upon receipt"}`, rightX, bodyTop + 32, { width: 160, align: "right", lineBreak: false });

      const amountBoxY = cardY + cardHeight - innerPad - 46;
      doc.roundedRect(rightX, amountBoxY, 160, 40, 8).fill("#f4f7fb").stroke("#d7deea");
      doc.fillColor("#6b7280").font("Helvetica").fontSize(8)
        .text("Amount Due", rightX + 12, amountBoxY + 7, { width: 136, align: "right", lineBreak: false });
      doc.fillColor("#1e3c72").font("Helvetica-Bold").fontSize(15)
        .text(`Rs ${invoice.amountPkr.toLocaleString("en-PK")}`, rightX + 12, amountBoxY + 20, { width: 136, align: "right", lineBreak: false });
    }

    for (let i = 0; i < invoices.length; i++) {
      if (i > 0 && i % 3 === 0) {
        doc.addPage();
      }
      drawCard(invoices[i], i % 3);
    }

    doc.end();
  });
}

// Send all invoices to their respective student emails (with portal access link)
router.post("/invoices/send-all", async (req, res) => {
  const rows = await db
    .select({
      id: invoicesTable.id,
      studentId: invoicesTable.studentId,
      invoiceNumber: invoicesTable.invoiceNumber,
      amount: invoicesTable.amount,
      issuedDate: invoicesTable.issuedDate,
      dueDate: invoicesTable.dueDate,
      status: invoicesTable.status,
      pdfUrl: invoicesTable.pdfUrl,
      studentName: studentsTable.fullName,
      studentEmail: studentsTable.email,
      studentIdNumber: studentsTable.idNumber,
      studentBatch: studentsTable.batch,
    })
    .from(invoicesTable)
    .innerJoin(studentsTable, eq(invoicesTable.studentId, studentsTable.id));

  let sent = 0;
  const failed: { invoiceNumber: string; email: string; error: string }[] = [];

  await Promise.allSettled(
    rows.map(async (row) => {
      if (!row.studentEmail) {
        failed.push({ invoiceNumber: row.invoiceNumber, email: "(none)", error: "No email on record" });
        return;
      }
      try {
        const amountPkr = parseFloat(row.amount);
        const pdfBuffer = await buildInvoicePdfBuffer({
          invoiceNumber: row.invoiceNumber,
          issuedDate: row.issuedDate,
          dueDate: row.dueDate ?? null,
          status: row.status,
          amountPkr: Number.isFinite(amountPkr) ? amountPkr : FIXED_STUDENT_FEE_PKR,
          student: {
            fullName: row.studentName,
            idNumber: row.studentIdNumber,
            batch: row.studentBatch,
            email: row.studentEmail,
          },
        });

        await uploadInvoicePdfAndSave({
          invoiceId: row.id,
          invoiceNumber: row.invoiceNumber,
          pdfBuffer,
        });

        await sendInvoiceEmail({
          toEmail: row.studentEmail,
          toName: row.studentName,
          invoiceNumber: row.invoiceNumber,
          pdfFileName: `${row.invoiceNumber}.pdf`,
          pdfBuffer,
          portalUrl: PORTAL_URL,
        });
        sent++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        failed.push({ invoiceNumber: row.invoiceNumber, email: row.studentEmail, error: message });
      }
    }),
  );

  res.json({ sent, failed: failed.length, total: rows.length, details: failed });
});

// List invoices
router.get("/invoices", async (req, res) => {
  const { studentId, status } = req.query as {
    studentId?: string;
    status?: string;
  };

  const rows = await db
    .select({
      id: invoicesTable.id,
      studentId: invoicesTable.studentId,
      studentName: studentsTable.fullName,
      paymentId: invoicesTable.paymentId,
      invoiceNumber: invoicesTable.invoiceNumber,
      amount: invoicesTable.amount,
      issuedDate: invoicesTable.issuedDate,
      dueDate: invoicesTable.dueDate,
      status: invoicesTable.status,
      pdfUrl: invoicesTable.pdfUrl,
      createdAt: invoicesTable.createdAt,
    })
    .from(invoicesTable)
    .innerJoin(studentsTable, eq(invoicesTable.studentId, studentsTable.id));

  let filtered = rows;
  if (studentId) filtered = filtered.filter((r) => r.studentId === studentId);
  if (status) filtered = filtered.filter((r) => r.status === status);

  res.json(
    filtered.map((r) => ({
      ...r,
      amount: parseFloat(r.amount),
      issuedDate: r.issuedDate.toISOString(),
      createdAt: r.createdAt.toISOString(),
    })),
  );
});

// Create invoice
router.post("/invoices", async (req, res) => {
  const body = req.body as {
    studentId: string;
    paymentId?: string | null;
    amount?: number;
    dueDate?: string | null;
  };

  const invoiceNumber = await generateInvoiceNumber(body.studentId);

  const [invoice] = await db
    .insert(invoicesTable)
    .values({
      studentId: body.studentId,
      paymentId: body.paymentId ?? null,
      invoiceNumber,
      amount: FIXED_STUDENT_FEE_PKR.toString(),
      dueDate: body.dueDate ?? null,
      status: "unpaid",
    })
    .returning();

  const [student] = await db
    .select()
    .from(studentsTable)
    .where(eq(studentsTable.id, body.studentId))
    .limit(1);

  let pdfUrl: string | null = invoice.pdfUrl ?? null;
  if (student?.email) {
    const pdfFileName = `${invoiceNumber}.pdf`;
    const pdfBuffer = await buildInvoicePdfBuffer({
      invoiceNumber,
      issuedDate: invoice.issuedDate,
      dueDate: invoice.dueDate ?? null,
      status: invoice.status,
      amountPkr: FIXED_STUDENT_FEE_PKR,
      student: {
        fullName: student.fullName,
        idNumber: student.idNumber,
        batch: student.batch,
        email: student.email,
      },
      });

    pdfUrl = await uploadInvoicePdfAndSave({
      invoiceId: invoice.id,
      invoiceNumber,
      pdfBuffer,
    });

    sendInvoiceEmail({
      toEmail: student.email,
      toName: student.fullName,
      invoiceNumber,
      pdfFileName,
      pdfBuffer,
    }).catch((err) => {
      (req as Record<string, any>)["log"]?.warn({ err }, "Failed to send invoice email");
    });
  }

  res.status(201).json({
    ...invoice,
    studentName: student?.fullName ?? null,
    amount: parseFloat(invoice.amount),
    pdfUrl,
    issuedDate: invoice.issuedDate.toISOString(),
    createdAt: invoice.createdAt.toISOString(),
  });
});

// Generate monthly invoices for all students
router.post("/invoices/generate-monthly", async (req, res) => {
  const { month } = (req.body ?? {}) as { month?: string };
  const now = new Date();
  const targetMonth = month || format(now, "yyyy-MM");
  const [yr, mo] = targetMonth.split("-").map(Number);

  // 15th of the target month as due date
  const dueDate = format(new Date(yr, mo - 1, 15), "yyyy-MM-dd");
  const prefix = `INV-${targetMonth.replace("-", "")}`;

  const students = await db.select().from(studentsTable);

  const createdInvoices = [];
  let skipped = 0;

  for (const student of students) {
    // Check if invoice already exists for this student this month
    const existing = await db
      .select()
      .from(invoicesTable)
      .where(and(eq(invoicesTable.studentId, student.id), like(invoicesTable.invoiceNumber, `${prefix}%`)))
      .limit(1);

    if (existing.length > 0) {
      skipped++;
      continue;
    }

    // Count existing invoices for this month (for numbering)
    const allForMonth = await db
      .select()
      .from(invoicesTable)
      .where(like(invoicesTable.invoiceNumber, `${prefix}%`));

    const count = (allForMonth.length + 1).toString().padStart(4, "0");
    const invoiceNumber = `${prefix}-${count}`;

    const [invoice] = await db
      .insert(invoicesTable)
      .values({
        studentId: student.id,
        invoiceNumber,
        amount: FIXED_STUDENT_FEE_PKR.toString(),
        dueDate,
        status: "unpaid",
      })
      .returning();

    createdInvoices.push({
      ...invoice,
      studentName: student.fullName,
      amount: FIXED_STUDENT_FEE_PKR,
      pdfUrl: invoice.pdfUrl ?? null,
      issuedDate: invoice.issuedDate.toISOString(),
      createdAt: invoice.createdAt.toISOString(),
    });
  }

  await Promise.allSettled(
    createdInvoices.map(async (inv) => {
      const [student] = await db
        .select()
        .from(studentsTable)
        .where(eq(studentsTable.id, inv.studentId))
        .limit(1);
      if (!student?.email) return;

      const pdfFileName = `${inv.invoiceNumber}.pdf`;
      const pdfBuffer = await buildInvoicePdfBuffer({
        invoiceNumber: inv.invoiceNumber,
        issuedDate: new Date(inv.issuedDate),
        dueDate: inv.dueDate ?? null,
        status: inv.status,
        amountPkr: FIXED_STUDENT_FEE_PKR,
        student: {
          fullName: student.fullName,
          idNumber: student.idNumber,
          batch: student.batch,
          email: student.email,
        },
      });

      inv.pdfUrl = await uploadInvoicePdfAndSave({
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        pdfBuffer,
      });

      await sendInvoiceEmail({
        toEmail: student.email,
        toName: student.fullName,
        invoiceNumber: inv.invoiceNumber,
        pdfFileName,
        pdfBuffer,
      });
    }),
  );

  res.json({
    month: targetMonth,
    created: createdInvoices.length,
    skipped,
    invoices: createdInvoices,
  });
});

// Preview monthly invoices before generating
router.post("/invoices/preview-monthly", async (req, res) => {
  const { month } = (req.body ?? {}) as { month?: string };
  const now = new Date();
  const targetMonth = month || format(now, "yyyy-MM");
  const [yr, mo] = targetMonth.split("-").map(Number);

  // 15th of the target month as due date
  const dueDate = format(new Date(yr, mo - 1, 15), "yyyy-MM-dd");
  const prefix = `INV-${targetMonth.replace("-", "")}`;

  const students = await db.select().from(studentsTable);
  const toCreate = [];
  let totalSkipped = 0;

  // Count existing database invoices for this month (for numbering)
  const allForMonth = await db
    .select()
    .from(invoicesTable)
    .where(like(invoicesTable.invoiceNumber, `${prefix}%`));

  let numberingCounter = allForMonth.length;

  for (const student of students) {
    // Check if invoice already exists for this student this month
    const existing = await db
      .select()
      .from(invoicesTable)
      .where(and(eq(invoicesTable.studentId, student.id), like(invoicesTable.invoiceNumber, `${prefix}%`)))
      .limit(1);

    if (existing.length > 0) {
      totalSkipped++;
      continue;
    }

    numberingCounter++;
    const invoiceNumber = `${prefix}-${numberingCounter.toString().padStart(4, "0")}`;

    toCreate.push({
      studentId: student.id,
      studentName: student.fullName,
      studentIdNumber: student.idNumber,
      invoiceNumber,
      amount: FIXED_STUDENT_FEE_PKR,
      dueDate,
    });
  }

  res.json({
    month: targetMonth,
    totalToCreate: toCreate.length,
    totalSkipped,
    toCreate,
  });
});

router.get("/invoices/monthly-batch.pdf", async (req, res) => {
  const auth = await getAuthContext(req);
  if (!auth || auth.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  const month =
    typeof req.query.month === "string" && req.query.month.trim()
      ? req.query.month.trim()
      : format(new Date(), "yyyy-MM");
  const prefix = `INV-${month.replace("-", "")}`;

  const rows = await db
    .select({
      id: invoicesTable.id,
      invoiceNumber: invoicesTable.invoiceNumber,
      amount: invoicesTable.amount,
      issuedDate: invoicesTable.issuedDate,
      dueDate: invoicesTable.dueDate,
      status: invoicesTable.status,
      studentName: studentsTable.fullName,
      studentEmail: studentsTable.email,
      studentIdNumber: studentsTable.idNumber,
      studentBatch: studentsTable.batch,
    })
    .from(invoicesTable)
    .innerJoin(studentsTable, eq(invoicesTable.studentId, studentsTable.id))
    .where(like(invoicesTable.invoiceNumber, `${prefix}%`))
    .orderBy(invoicesTable.invoiceNumber);

  if (rows.length === 0) {
    res.status(404).json({ error: "No invoices found for the selected month" });
    return;
  }

  const pdfBuffer = await buildInvoiceCardPageBuffer(
    rows.map((row) => ({
      invoiceNumber: row.invoiceNumber,
      issuedDate: row.issuedDate,
      dueDate: row.dueDate ?? null,
      status: row.status,
      amountPkr: Number.parseFloat(row.amount) || FIXED_STUDENT_FEE_PKR,
      student: {
        fullName: row.studentName,
        idNumber: row.studentIdNumber,
        batch: row.studentBatch,
        email: row.studentEmail,
      },
    })),
  );

  res.setHeader("content-type", "application/pdf");
  res.setHeader("content-disposition", `attachment; filename="Monthly-Invoices-${month}.pdf"`);
  res.send(pdfBuffer);
});

router.get("/invoices/:id/pdf", async (req, res) => {
  const auth = await getAuthContext(req);
  const effectiveAuth = auth ?? { role: "admin", email: "", studentId: null };

  const [row] = await db
    .select({
      id: invoicesTable.id,
      studentId: invoicesTable.studentId,
      invoiceNumber: invoicesTable.invoiceNumber,
      amount: invoicesTable.amount,
      issuedDate: invoicesTable.issuedDate,
      dueDate: invoicesTable.dueDate,
      status: invoicesTable.status,
      pdfUrl: invoicesTable.pdfUrl,
      studentName: studentsTable.fullName,
      studentEmail: studentsTable.email,
      studentIdNumber: studentsTable.idNumber,
      studentBatch: studentsTable.batch,
    })
    .from(invoicesTable)
    .innerJoin(studentsTable, eq(invoicesTable.studentId, studentsTable.id))
    .where(eq(invoicesTable.id, req.params.id))
    .limit(1);

  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  if (effectiveAuth.role === "student" && effectiveAuth.studentId !== row.studentId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const amountPkr = parseFloat(row.amount);
  const pdfBuffer = await buildInvoicePdfBuffer({
    invoiceNumber: row.invoiceNumber,
    issuedDate: row.issuedDate,
    dueDate: row.dueDate ?? null,
    status: row.status,
    amountPkr: Number.isFinite(amountPkr) ? amountPkr : FIXED_STUDENT_FEE_PKR,
    student: {
      fullName: row.studentName,
      idNumber: row.studentIdNumber,
      batch: row.studentBatch,
      email: row.studentEmail,
    },
  });

  if (!row.pdfUrl) {
    await uploadInvoicePdfAndSave({
      invoiceId: row.id,
      invoiceNumber: row.invoiceNumber,
      pdfBuffer,
    });
  }

  res.setHeader("content-type", "application/pdf");
  res.setHeader("content-disposition", `attachment; filename="${row.invoiceNumber}.pdf"`);
  res.send(pdfBuffer);
});

// Get invoice
router.get("/invoices/:id", async (req, res) => {
  const [row] = await db
    .select({
      id: invoicesTable.id,
      studentId: invoicesTable.studentId,
      studentName: studentsTable.fullName,
      paymentId: invoicesTable.paymentId,
      invoiceNumber: invoicesTable.invoiceNumber,
      amount: invoicesTable.amount,
      issuedDate: invoicesTable.issuedDate,
      dueDate: invoicesTable.dueDate,
      status: invoicesTable.status,
      pdfUrl: invoicesTable.pdfUrl,
      createdAt: invoicesTable.createdAt,
    })
    .from(invoicesTable)
    .innerJoin(studentsTable, eq(invoicesTable.studentId, studentsTable.id))
    .where(eq(invoicesTable.id, req.params.id))
    .limit(1);

  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  res.json({
    ...row,
    amount: parseFloat(row.amount),
    issuedDate: row.issuedDate.toISOString(),
    createdAt: row.createdAt.toISOString(),
  });
});

// Update invoice
router.patch("/invoices/:id", async (req, res) => {
  const body = req.body as { status?: string };

  const [invoice] = await db
    .update(invoicesTable)
    .set({ ...(body.status !== undefined && { status: body.status }) })
    .where(eq(invoicesTable.id, req.params.id))
    .returning();

  if (!invoice) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const [student] = await db
    .select()
    .from(studentsTable)
    .where(eq(studentsTable.id, invoice.studentId))
    .limit(1);

  res.json({
    ...invoice,
    studentName: student?.fullName ?? null,
    amount: parseFloat(invoice.amount),
    issuedDate: invoice.issuedDate.toISOString(),
    createdAt: invoice.createdAt.toISOString(),
  });
});

export default router;
