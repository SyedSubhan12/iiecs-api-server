import { Router } from "express";
import { db, studentsTable, attendanceTable, paymentsTable } from "@workspace/db";
import { eq, like, or, and, sql } from "drizzle-orm";

const router = Router();

function buildQrCodeData(student: {
  id: string;
  fullName: string;
  email: string;
  idNumber: string;
  batch: string;
  enrollmentDate: Date;
}) {
  return JSON.stringify({
    id: student.id,
    name: student.fullName,
    email: student.email,
    idNumber: student.idNumber,
    batch: student.batch,
    enrollmentDate: student.enrollmentDate.toISOString().split("T")[0],
  });
}

// List students
router.get("/students", async (req, res) => {
  const { batch, status, search } = req.query as {
    batch?: string;
    status?: string;
    search?: string;
  };

  let query = db.select().from(studentsTable).$dynamic();

  const conditions = [];
  if (batch) conditions.push(eq(studentsTable.batch, batch));
  if (status) conditions.push(eq(studentsTable.status, status));
  if (search) {
    conditions.push(
      or(
        like(studentsTable.fullName, `%${search}%`),
        like(studentsTable.email, `%${search}%`),
        like(studentsTable.idNumber, `%${search}%`),
      )!,
    );
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  const students = await query.orderBy(studentsTable.idNumber);
  res.json(
    students.map((s) => ({
      ...s,
      enrollmentDate: s.enrollmentDate.toISOString(),
      createdAt: s.createdAt.toISOString(),
    })),
  );
});

// Create student
router.post("/students", async (req, res) => {
  const body = req.body as {
    email: string;
    fullName: string;
    idNumber: string;
    batch: string;
    phone?: string;
    address?: string;
    cnic?: string;
  };

  const [student] = await db
    .insert(studentsTable)
    .values({
      email: body.email.toLowerCase().trim(),
      fullName: body.fullName,
      idNumber: body.idNumber,
      batch: body.batch,
      phone: body.phone ?? null,
      address: body.address ?? null,
      cnic: body.cnic ?? null,
      qrCodeData: "",
    })
    .returning();

  // Update QR code with real ID
  const qrData = buildQrCodeData(student);
  const [updated] = await db
    .update(studentsTable)
    .set({ qrCodeData: qrData })
    .where(eq(studentsTable.id, student.id))
    .returning();

  res.status(201).json({
    ...updated,
    enrollmentDate: updated.enrollmentDate.toISOString(),
    createdAt: updated.createdAt.toISOString(),
  });
});

// Get student by ID
router.get("/students/:id", async (req, res) => {
  const [student] = await db
    .select()
    .from(studentsTable)
    .where(eq(studentsTable.id, req.params.id))
    .limit(1);

  if (!student) {
    res.status(404).json({ error: "Student not found" });
    return;
  }
  res.json({
    ...student,
    enrollmentDate: student.enrollmentDate.toISOString(),
    createdAt: student.createdAt.toISOString(),
  });
});

// Update student
router.patch("/students/:id", async (req, res) => {
  const body = req.body as {
    fullName?: string;
    phone?: string | null;
    address?: string | null;
    cnic?: string | null;
    status?: string;
  };

  const [student] = await db
    .update(studentsTable)
    .set({
      ...(body.fullName !== undefined && { fullName: body.fullName }),
      ...(body.phone !== undefined && { phone: body.phone }),
      ...(body.address !== undefined && { address: body.address }),
      ...(body.cnic !== undefined && { cnic: body.cnic }),
      ...(body.status !== undefined && { status: body.status }),
    })
    .where(eq(studentsTable.id, req.params.id))
    .returning();

  if (!student) {
    res.status(404).json({ error: "Student not found" });
    return;
  }
  res.json({
    ...student,
    enrollmentDate: student.enrollmentDate.toISOString(),
    createdAt: student.createdAt.toISOString(),
  });
});

// Get student by email
router.get("/students/by-email/:email", async (req, res) => {
  const [student] = await db
    .select()
    .from(studentsTable)
    .where(eq(studentsTable.email, decodeURIComponent(req.params.email).toLowerCase()))
    .limit(1);

  if (!student) {
    res.status(404).json({ error: "Student not found" });
    return;
  }
  res.json({
    ...student,
    enrollmentDate: student.enrollmentDate.toISOString(),
    createdAt: student.createdAt.toISOString(),
  });
});

// Get student progress
router.get("/students/:id/progress", async (req, res) => {
  const [student] = await db
    .select()
    .from(studentsTable)
    .where(eq(studentsTable.id, req.params.id))
    .limit(1);

  if (!student) {
    res.status(404).json({ error: "Student not found" });
    return;
  }

  const records = await db
    .select()
    .from(attendanceTable)
    .where(eq(attendanceTable.studentId, req.params.id));

  const total = records.length;
  const present = records.filter((r) => r.status === "present").length;
  const absent = records.filter((r) => r.status === "absent").length;
  const late = records.filter((r) => r.status === "late").length;
  const pct = total > 0 ? Math.round((present / total) * 10000) / 100 : 0;

  const payments = await db
    .select()
    .from(paymentsTable)
    .where(eq(paymentsTable.studentId, req.params.id));

  const totalPaid = payments
    .filter((p) => p.status === "paid")
    .reduce((s, p) => s + parseFloat(p.amount), 0);

  const totalPending = payments
    .filter((p) => p.status === "pending" || p.status === "overdue")
    .reduce((s, p) => s + parseFloat(p.amount), 0);

  res.json({
    studentId: student.id,
    fullName: student.fullName,
    overallAttendancePercentage: pct,
    totalAttendanceRecords: total,
    daysPresent: present,
    daysAbsent: absent,
    daysLate: late,
    totalPaid,
    totalPending,
  });
});

export default router;
