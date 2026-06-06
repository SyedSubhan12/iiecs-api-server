import { Router } from "express";
import { db, invoicesTable, studentsTable } from "@workspace/db";
import { eq, and, like } from "drizzle-orm";
import { format } from "date-fns";
import PDFDocument from "pdfkit";
import ejs from "ejs";
import path from "path";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";

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

async function sendInvoiceEmail(input: {
  toEmail: string;
  toName: string;
  invoiceNumber: string;
  pdfFileName: string;
  pdfBuffer: Buffer;
}) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return;

  const senderEmail = process.env.BREVO_SENDER_EMAIL ?? "noreply@iiecs.edu";
  const senderName = process.env.BREVO_SENDER_NAME ?? "IIECS Admin";

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: { email: senderEmail, name: senderName },
      to: [{ email: input.toEmail, name: input.toName }],
      subject: `Fee Invoice ${input.invoiceNumber}`,
      htmlContent: `<p>Dear ${input.toName},</p><p>Please find attached your fee invoice <strong>${input.invoiceNumber}</strong>.</p><p>Regards,<br/>${senderName}</p>`,
      attachment: [
        {
          name: input.pdfFileName,
          content: input.pdfBuffer.toString("base64"),
        },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Brevo SMTP API error (${res.status}): ${text}`);
  }
}

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
