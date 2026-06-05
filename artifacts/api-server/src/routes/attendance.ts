import { Router } from "express";
import { db, attendanceTable, studentsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { readFileSync } from "node:fs";

const router = Router();

// #region debug-point A:config
const debugConfig = (() => {
  const fallback = {
    url: "http://127.0.0.1:7777/event",
    sessionId: "qr-scan-student-not-found",
  };
  try {
    const envFile = readFileSync(
      ".dbg/qr-scan-student-not-found.env",
      "utf8",
    );
    return {
      url:
        envFile.match(/DEBUG_SERVER_URL=(.+)/)?.[1]?.trim() ?? fallback.url,
      sessionId:
        envFile.match(/DEBUG_SESSION_ID=(.+)/)?.[1]?.trim() ??
        fallback.sessionId,
    };
  } catch {
    return fallback;
  }
})();

function reportDebug(
  hypothesisId: "A" | "B" | "C" | "D" | "E",
  location: string,
  msg: string,
  data: Record<string, unknown>,
  traceId?: string,
) {
  fetch(debugConfig.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: debugConfig.sessionId,
      runId: "post-fix",
      hypothesisId,
      location,
      msg: `[DEBUG] ${msg}`,
      data,
      traceId,
      ts: Date.now(),
    }),
  }).catch(() => {});
}
// #endregion

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function normalizeStudentIdNumber(value: string) {
  return value.trim().toUpperCase();
}

// Scan QR code
router.post("/attendance/scan", async (req, res) => {
  const { qrData } = req.body as { qrData?: string };
  const traceId = `scan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  // #region debug-point A:request-received
  reportDebug("A", "attendance.ts:scan:start", "Attendance scan request received", {
    hasQrData: Boolean(qrData),
    qrPreview: qrData?.slice(0, 160) ?? null,
    qrLength: qrData?.length ?? 0,
  }, traceId);
  // #endregion
  if (!qrData) {
    res.status(400).json({ error: "qrData required" });
    return;
  }

  let studentUuid: string | undefined;
  let studentIdNumber: string | undefined;

  try {
    // Updated parsing to handle multiple possible fields
    const parsed = JSON.parse(qrData);
    const possibleIdFields = ["id", "studentId", "student_id"]; // common variations
    const possibleIdNumberFields = ["idNumber", "id_number", "studentIdNumber", "student_id_number"];
    const parsedId = possibleIdFields.reduce((acc, key) => acc ?? (typeof parsed[key] === "string" ? parsed[key].trim() : undefined), undefined);
    const parsedIdNumber = possibleIdNumberFields.reduce((acc, key) => acc ?? (typeof parsed[key] === "string" ? parsed[key] : undefined), undefined);
    if (parsedId) {
      if (isUuid(parsedId)) {
        studentUuid = parsedId;
      } else {
        studentIdNumber = normalizeStudentIdNumber(parsedId);
      }
    }
    if (!studentIdNumber && parsedIdNumber) {
      studentIdNumber = normalizeStudentIdNumber(parsedIdNumber);
    }

    if (parsedId) {
      if (isUuid(parsedId)) {
        studentUuid = parsedId;
      } else {
        studentIdNumber = normalizeStudentIdNumber(parsedId);
      }
    }

    if (!studentIdNumber && parsedIdNumber) {
      studentIdNumber = normalizeStudentIdNumber(parsedIdNumber);
    }
    // #region debug-point B:json-parse
    reportDebug("B", "attendance.ts:scan:json", "Parsed QR payload as JSON", {
      parsedKeys: Object.keys(parsed),
      studentUuid,
      studentIdNumber,
    }, traceId);
    // #endregion
  } catch {
    // If not JSON, try to extract IIECS-XXX pattern from raw string/URL
    const match = qrData.match(/IIECS-\d+/i);
    if (match) {
      studentIdNumber = normalizeStudentIdNumber(match[0]);
    } else {
      studentIdNumber = normalizeStudentIdNumber(qrData);
    }
    // #region debug-point C:fallback-parse
    reportDebug("C", "attendance.ts:scan:fallback", "Fell back to raw QR parsing", {
      matchedPattern: match?.[0] ?? null,
      normalizedStudentIdNumber: studentIdNumber,
    }, traceId);
    // #endregion
  }

  let student;
  if (studentUuid) {
    // #region debug-point A:lookup-by-uuid
    reportDebug("A", "attendance.ts:scan:lookup-uuid", "Looking up student by UUID", {
      studentUuid,
    }, traceId);
    // #endregion
    [student] = await db
      .select()
      .from(studentsTable)
      .where(eq(studentsTable.id, studentUuid))
      .limit(1);
    // #region debug-point A:lookup-by-uuid-result
    reportDebug("A", "attendance.ts:scan:lookup-uuid-result", "UUID lookup finished", {
      found: Boolean(student),
      studentId: student?.id ?? null,
      studentIdNumber: student?.idNumber ?? null,
    }, traceId);
    // #endregion
  }

  if (!student && studentIdNumber) {
    // #region debug-point D:lookup-by-id-number
    reportDebug("D", "attendance.ts:scan:lookup-id-number", "Looking up student by ID number", {
      studentIdNumber,
    }, traceId);
    // #endregion
    [student] = await db
      .select()
      .from(studentsTable)
      .where(eq(studentsTable.idNumber, studentIdNumber))
      .limit(1);
    // #region debug-point D:lookup-by-id-number-result
    reportDebug("D", "attendance.ts:scan:lookup-id-number-result", "ID number lookup finished", {
      found: Boolean(student),
      studentId: student?.id ?? null,
      studentIdNumber: student?.idNumber ?? null,
    }, traceId);
    // #endregion
  }

  if (!student) {
    // #region debug-point E:not-found
    reportDebug("E", "attendance.ts:scan:not-found", "Student not found after QR parsing and lookup", {
      studentUuid: studentUuid ?? null,
      studentIdNumber: studentIdNumber ?? null,
    }, traceId);
    // #endregion
    res.status(404).json({ error: "Student not found" });
    return;
  }

  const today = todayStr();
  const [existing] = await db
    .select()
    .from(attendanceTable)
    .where(
      and(
        eq(attendanceTable.studentId, student.id),
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
  const { studentId, date, month, batch, studentName, status } = req.query as {
    studentId?: string;
    date?: string;
    month?: string;
    batch?: string;
    studentName?: string;
    status?: string;
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
  if (studentName) {
    const searchName = studentName.toLowerCase();
    filtered = filtered.filter((r) => 
      r.studentName.toLowerCase().includes(searchName) || 
      r.studentIdNumber.toLowerCase().includes(searchName)
    );
  }
  if (status) filtered = filtered.filter((r) => r.status === status);

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

// Delete ALL attendance records (admin danger zone)
router.delete("/attendance", async (_req, res) => {
  const result = await db.delete(attendanceTable).returning({ id: attendanceTable.id });
  res.json({ deleted: result.length });
});

export default router;
