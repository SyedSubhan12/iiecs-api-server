import { Router } from "express";
import { db, attendanceTable, studentsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";

const router = Router();

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

// Scan QR code
router.post("/attendance/scan", async (req, res) => {
  const { qrData } = req.body as { qrData?: string };
  if (!qrData) {
    res.status(400).json({ error: "qrData required" });
    return;
  }

  let parsed: { id?: string; email?: string; idNumber?: string } = {};
  try {
    parsed = JSON.parse(qrData);
  } catch {
    res.status(400).json({ error: "Invalid QR data format" });
    return;
  }

  const studentId = parsed.id;
  if (!studentId) {
    res.status(400).json({ error: "QR code missing student ID" });
    return;
  }

  const [student] = await db
    .select()
    .from(studentsTable)
    .where(eq(studentsTable.id, studentId))
    .limit(1);

  if (!student) {
    res.status(404).json({ error: "Student not found" });
    return;
  }

  const today = todayStr();
  const [existing] = await db
    .select()
    .from(attendanceTable)
    .where(
      and(
        eq(attendanceTable.studentId, studentId),
        eq(attendanceTable.attendanceDate, today),
      ),
    )
    .limit(1);

  const fmt = (s: { enrollmentDate: Date; createdAt: Date }) => ({
    ...s,
    enrollmentDate: s.enrollmentDate.toISOString(),
    createdAt: s.createdAt.toISOString(),
  });

  const fmtA = (a: {
    checkInTime: Date;
    checkOutTime: Date | null;
    createdAt: Date;
    updatedAt: Date;
    id: string;
    studentId: string;
    attendanceDate: string;
    status: string;
    markedBy: string | null;
    remarks: string | null;
  }) => ({
    ...a,
    studentName: student.fullName,
    studentIdNumber: student.idNumber,
    checkInTime: a.checkInTime.toISOString(),
    checkOutTime: a.checkOutTime?.toISOString() ?? null,
    createdAt: a.createdAt.toISOString(),
  });

  res.json({
    student: fmt(student),
    alreadyMarkedToday: !!existing,
    todayRecord: existing ? fmtA(existing) : null,
  });
});

// List attendance
router.get("/attendance", async (req, res) => {
  const { studentId, date, month, batch } = req.query as {
    studentId?: string;
    date?: string;
    month?: string;
    batch?: string;
  };

  const rows = await db
    .select({
      id: attendanceTable.id,
      studentId: attendanceTable.studentId,
      studentName: studentsTable.fullName,
      studentIdNumber: studentsTable.idNumber,
      attendanceDate: attendanceTable.attendanceDate,
      checkInTime: attendanceTable.checkInTime,
      checkOutTime: attendanceTable.checkOutTime,
      status: attendanceTable.status,
      remarks: attendanceTable.remarks,
      createdAt: attendanceTable.createdAt,
      batch: studentsTable.batch,
    })
    .from(attendanceTable)
    .innerJoin(studentsTable, eq(attendanceTable.studentId, studentsTable.id))
    .orderBy(sql`${attendanceTable.attendanceDate} DESC`);

  let filtered = rows;
  if (studentId) filtered = filtered.filter((r) => r.studentId === studentId);
  if (date) filtered = filtered.filter((r) => r.attendanceDate === date);
  if (month) filtered = filtered.filter((r) => r.attendanceDate.startsWith(month));
  if (batch) filtered = filtered.filter((r) => r.batch === batch);

  res.json(
    filtered.map((r) => ({
      ...r,
      checkInTime: r.checkInTime.toISOString(),
      checkOutTime: r.checkOutTime?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    })),
  );
});

// Mark attendance
router.post("/attendance", async (req, res) => {
  const body = req.body as {
    studentId: string;
    status: string;
    attendanceDate?: string;
    checkInTime?: string;
    checkOutTime?: string | null;
    remarks?: string | null;
  };

  const date = body.attendanceDate ?? todayStr();

  // upsert: delete existing for same student+date then insert
  await db
    .delete(attendanceTable)
    .where(
      and(
        eq(attendanceTable.studentId, body.studentId),
        eq(attendanceTable.attendanceDate, date),
      ),
    );

  const [record] = await db
    .insert(attendanceTable)
    .values({
      studentId: body.studentId,
      attendanceDate: date,
      checkInTime: body.checkInTime ? new Date(body.checkInTime) : new Date(),
      checkOutTime: body.checkOutTime ? new Date(body.checkOutTime) : null,
      status: body.status,
      remarks: body.remarks ?? null,
    })
    .returning();

  const [student] = await db
    .select()
    .from(studentsTable)
    .where(eq(studentsTable.id, body.studentId))
    .limit(1);

  res.status(201).json({
    ...record,
    studentName: student?.fullName ?? null,
    studentIdNumber: student?.idNumber ?? null,
    checkInTime: record.checkInTime.toISOString(),
    checkOutTime: record.checkOutTime?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
  });
});

// Update attendance
router.patch("/attendance/:id", async (req, res) => {
  const body = req.body as {
    status?: string;
    checkOutTime?: string | null;
    remarks?: string | null;
  };

  const [record] = await db
    .update(attendanceTable)
    .set({
      ...(body.status !== undefined && { status: body.status }),
      ...(body.checkOutTime !== undefined && {
        checkOutTime: body.checkOutTime ? new Date(body.checkOutTime) : null,
      }),
      ...(body.remarks !== undefined && { remarks: body.remarks }),
    })
    .where(eq(attendanceTable.id, req.params.id))
    .returning();

  if (!record) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const [student] = await db
    .select()
    .from(studentsTable)
    .where(eq(studentsTable.id, record.studentId))
    .limit(1);

  res.json({
    ...record,
    studentName: student?.fullName ?? null,
    studentIdNumber: student?.idNumber ?? null,
    checkInTime: record.checkInTime.toISOString(),
    checkOutTime: record.checkOutTime?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
  });
});

// Monthly attendance report
router.get("/attendance/report/monthly", async (req, res) => {
  const { month, batch } = req.query as { month?: string; batch?: string };

  const students = await db
    .select()
    .from(studentsTable)
    .where(batch ? eq(studentsTable.batch, batch) : undefined);

  const allRecords = await db.select().from(attendanceTable);

  const report = students.map((s) => {
    let records = allRecords.filter((r) => r.studentId === s.id);
    if (month) records = records.filter((r) => r.attendanceDate.startsWith(month));
    const total = records.length;
    const present = records.filter((r) => r.status === "present").length;
    const absent = records.filter((r) => r.status === "absent").length;
    const late = records.filter((r) => r.status === "late").length;
    const pct = total > 0 ? Math.round((present / total) * 10000) / 100 : 0;
    return {
      studentId: s.id,
      fullName: s.fullName,
      idNumber: s.idNumber,
      batch: s.batch,
      daysPresent: present,
      daysAbsent: absent,
      daysLate: late,
      totalDays: total,
      attendancePercentage: pct,
    };
  });

  res.json(report);
});

// Today's attendance
router.get("/attendance/today", async (req, res) => {
  const today = todayStr();
  const rows = await db
    .select({
      id: attendanceTable.id,
      studentId: attendanceTable.studentId,
      studentName: studentsTable.fullName,
      studentIdNumber: studentsTable.idNumber,
      attendanceDate: attendanceTable.attendanceDate,
      checkInTime: attendanceTable.checkInTime,
      checkOutTime: attendanceTable.checkOutTime,
      status: attendanceTable.status,
      remarks: attendanceTable.remarks,
      createdAt: attendanceTable.createdAt,
    })
    .from(attendanceTable)
    .innerJoin(studentsTable, eq(attendanceTable.studentId, studentsTable.id))
    .where(eq(attendanceTable.attendanceDate, today));

  res.json(
    rows.map((r) => ({
      ...r,
      checkInTime: r.checkInTime.toISOString(),
      checkOutTime: r.checkOutTime?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    })),
  );
});

export default router;
