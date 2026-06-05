import { Router } from "express";
import { db, invoicesTable, studentsTable } from "@workspace/db";
import { eq, and, like } from "drizzle-orm";
import { format } from "date-fns";

const router = Router();

async function generateInvoiceNumber(studentId: string): Promise<string> {
  const now = new Date();
  const prefix = `INV-${format(now, "yyyyMM")}`;
  const existing = await db
    .select()
    .from(invoicesTable)
    .where(eq(invoicesTable.studentId, studentId));
  const count = (existing.length + 1).toString().padStart(4, "0");
  return `${prefix}-${count}`;
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
    amount: number;
    dueDate?: string | null;
  };

  const invoiceNumber = await generateInvoiceNumber(body.studentId);

  const [invoice] = await db
    .insert(invoicesTable)
    .values({
      studentId: body.studentId,
      paymentId: body.paymentId ?? null,
      invoiceNumber,
      amount: body.amount.toString(),
      dueDate: body.dueDate ?? null,
      status: "unpaid",
    })
    .returning();

  const [student] = await db
    .select()
    .from(studentsTable)
    .where(eq(studentsTable.id, body.studentId))
    .limit(1);

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
        amount: "2000",
        dueDate,
        status: "unpaid",
      })
      .returning();

    createdInvoices.push({
      ...invoice,
      studentName: student.fullName,
      amount: 2000,
      issuedDate: invoice.issuedDate.toISOString(),
      createdAt: invoice.createdAt.toISOString(),
    });
  }

  res.json({
    month: targetMonth,
    created: createdInvoices.length,
    skipped,
    invoices: createdInvoices,
  });
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
