import { Router } from "express";
import { db, invoicesTable, studentsTable } from "@workspace/db";
import { eq, and, like } from "drizzle-orm";
import { format } from "date-fns";
import puppeteer from "puppeteer-core";
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

async function buildInvoicePdfBuffer(input: {
  invoiceNumber: string;
  issuedDate: Date;
  dueDate: string | null;
  status: string;
  amountPkr: number;
  student: { fullName: string; idNumber: string; batch: string; email: string };
}): Promise<Buffer> {
  // Render the EJS template with escaped data (EJS auto-escapes <%= %> tags)
  const html = await ejs.renderFile(TEMPLATE_PATH, {
    logoBase64: LOGO_BASE64,
    invoiceNumber: input.invoiceNumber,
    issuedDate: format(input.issuedDate, "yyyy-MM-dd"),
    dueDate: input.dueDate ?? "Upon receipt",
    status: input.status,
    studentName: input.student.fullName,
    studentId: input.student.idNumber,
    batch: input.student.batch,
    email: input.student.email,
    amountFormatted: input.amountPkr.toLocaleString("en-PK"),
  });

  // Locate the already-downloaded Chromium binary (cached from a previous install)
  const CHROMIUM_PATH =
    process.env.PUPPETEER_EXECUTABLE_PATH ??
    "/home/zaro/.cache/puppeteer/chrome/linux-146.0.7680.31/chrome-linux64/chrome";

  // Convert HTML to PDF via headless Chromium
  const browser = await puppeteer.launch({
    executablePath: CHROMIUM_PATH,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    headless: true,
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    const pdfUint8 = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "10mm", right: "10mm", bottom: "10mm", left: "10mm" },
    });
    return Buffer.from(pdfUint8);
  } finally {
    await browser.close();
  }
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
      req.log?.warn({ err }, "Failed to send invoice email");
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
