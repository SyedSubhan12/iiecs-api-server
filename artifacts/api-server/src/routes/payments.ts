import { Router } from "express";
import { db, paymentsTable, studentsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();
const FIXED_STUDENT_FEE_PKR = 2000;

// List payments
router.get("/payments", async (req, res) => {
  const { studentId, status } = req.query as {
    studentId?: string;
    status?: string;
  };

  const rows = await db
    .select({
      id: paymentsTable.id,
      studentId: paymentsTable.studentId,
      studentName: studentsTable.fullName,
      amount: paymentsTable.amount,
      description: paymentsTable.description,
      dueDate: paymentsTable.dueDate,
      paidDate: paymentsTable.paidDate,
      status: paymentsTable.status,
      paymentMethod: paymentsTable.paymentMethod,
      referenceNumber: paymentsTable.referenceNumber,
      notes: paymentsTable.notes,
      createdAt: paymentsTable.createdAt,
    })
    .from(paymentsTable)
    .innerJoin(studentsTable, eq(paymentsTable.studentId, studentsTable.id));

  let filtered = rows;
  if (studentId) filtered = filtered.filter((r) => r.studentId === studentId);
  if (status) filtered = filtered.filter((r) => r.status === status);

  res.json(
    filtered.map((r) => ({
      ...r,
      amount: parseFloat(r.amount),
      createdAt: r.createdAt.toISOString(),
    })),
  );
});

// Create payment
router.post("/payments", async (req, res) => {
  const body = req.body as {
    studentId: string;
    amount?: number;
    description?: string;
    dueDate?: string | null;
    notes?: string | null;
  };

  const [payment] = await db
    .insert(paymentsTable)
    .values({
      studentId: body.studentId,
      amount: FIXED_STUDENT_FEE_PKR.toString(),
      description: body.description ?? "Course Fee - IIECS-101",
      dueDate: body.dueDate ?? null,
      notes: body.notes ?? null,
      status: "pending",
    })
    .returning();

  const [student] = await db
    .select()
    .from(studentsTable)
    .where(eq(studentsTable.id, body.studentId))
    .limit(1);

  res.status(201).json({
    ...payment,
    studentName: student?.fullName ?? null,
    amount: parseFloat(payment.amount),
    createdAt: payment.createdAt.toISOString(),
  });
});

// Get payment
router.get("/payments/:id", async (req, res) => {
  const [row] = await db
    .select({
      id: paymentsTable.id,
      studentId: paymentsTable.studentId,
      studentName: studentsTable.fullName,
      amount: paymentsTable.amount,
      description: paymentsTable.description,
      dueDate: paymentsTable.dueDate,
      paidDate: paymentsTable.paidDate,
      status: paymentsTable.status,
      paymentMethod: paymentsTable.paymentMethod,
      referenceNumber: paymentsTable.referenceNumber,
      notes: paymentsTable.notes,
      createdAt: paymentsTable.createdAt,
    })
    .from(paymentsTable)
    .innerJoin(studentsTable, eq(paymentsTable.studentId, studentsTable.id))
    .where(eq(paymentsTable.id, req.params.id))
    .limit(1);

  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  res.json({ ...row, amount: parseFloat(row.amount), createdAt: row.createdAt.toISOString() });
});

// Update payment
router.patch("/payments/:id", async (req, res) => {
  const body = req.body as {
    status?: string;
    paidDate?: string | null;
    paymentMethod?: string | null;
    referenceNumber?: string | null;
    notes?: string | null;
  };

  const today = new Date().toISOString().split("T")[0];

  const [payment] = await db
    .update(paymentsTable)
    .set({
      ...(body.status !== undefined && { status: body.status }),
      ...(body.status === "paid" && !body.paidDate && { paidDate: today }),
      ...(body.paidDate !== undefined && { paidDate: body.paidDate }),
      ...(body.paymentMethod !== undefined && { paymentMethod: body.paymentMethod }),
      ...(body.referenceNumber !== undefined && { referenceNumber: body.referenceNumber }),
      ...(body.notes !== undefined && { notes: body.notes }),
    })
    .where(eq(paymentsTable.id, req.params.id))
    .returning();

  if (!payment) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const [student] = await db
    .select()
    .from(studentsTable)
    .where(eq(studentsTable.id, payment.studentId))
    .limit(1);

  res.json({
    ...payment,
    studentName: student?.fullName ?? null,
    amount: parseFloat(payment.amount),
    createdAt: payment.createdAt.toISOString(),
  });
});

// Delete payment by ID
router.delete("/payments/:id", async (req, res) => {
  const result = await db
    .delete(paymentsTable)
    .where(eq(paymentsTable.id, req.params.id))
    .returning({ id: paymentsTable.id });

  if (result.length === 0) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  res.json({ deleted: result[0].id });
});

// Delete ALL payments (admin danger zone)
router.delete("/payments", async (_req, res) => {
  const result = await db.delete(paymentsTable).returning({ id: paymentsTable.id });
  res.json({ deleted: result.length });
});

export default router;
