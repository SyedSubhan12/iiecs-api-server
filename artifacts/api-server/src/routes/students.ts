import { Router } from "express";
import { db, studentsTable, attendanceTable, paymentsTable } from "@workspace/db";
import { eq, like, or, and, sql } from "drizzle-orm";
import PDFDocument from "pdfkit";
import { processIdCardDirectory } from "../lib/id-card-import.js";
import { uploadPdfToSupabase } from "../lib/supabase-storage.js";

const router = Router();
const ADMIN_EMAILS = ["admin@iiecs.edu", "teacher@iiecs.edu"];

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

function buildIdCardPdfBuffer(student: {
  fullName: string;
  idNumber: string;
  batch: string;
  email: string;
  enrollmentDate: Date;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: [243, 153], margin: 14 });
    const chunks: Buffer[] = [];

    doc.on("data", (c: Buffer | Uint8Array) =>
      chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)),
    );
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.rect(0, 0, doc.page.width, doc.page.height).fill("#003366");
    doc.fillColor("#ffffff");

    doc.fontSize(10).text("IIECS Institute", 14, 12);
    doc.fontSize(7).fillColor("#ffc107").text("C/C++ Algorithms Program", 14, 26);

    doc.fillColor("#ffffff");
    doc.fontSize(12).text(student.fullName, 14, 52, { width: doc.page.width - 28 });
    doc.fontSize(9).fillColor("#ffc107").text(student.idNumber, 14, 70);

    doc.fillColor("#ffffff");
    doc.fontSize(7).text(`Batch: ${student.batch}`, 14, 90, { width: doc.page.width - 28 });
    doc.fontSize(7).text(`Email: ${student.email}`, 14, 103, { width: doc.page.width - 28 });
    doc.fontSize(7).text(`Enrolled: ${student.enrollmentDate.toISOString().split("T")[0]}`, 14, 116);

    doc.fillColor("#ffc107");
    doc.fontSize(7).text("STUDENT ID", doc.page.width - 80, doc.page.height - 22, {
      width: 66,
      align: "center",
    });

    doc.end();
  });
}

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

  let query = db
    .select({
      id: studentsTable.id,
      email: studentsTable.email,
      fullName: studentsTable.fullName,
      idNumber: studentsTable.idNumber,
      batch: studentsTable.batch,
      qrCodeData: studentsTable.qrCodeData,
      idCardUrl: studentsTable.idCardUrl,
      phone: studentsTable.phone,
      address: studentsTable.address,
      cnic: studentsTable.cnic,
      status: studentsTable.status,
      enrollmentDate: studentsTable.enrollmentDate,
      createdAt: studentsTable.createdAt,
    })
    .from(studentsTable)
    .$dynamic();

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
    id: updated.id,
    email: updated.email,
    fullName: updated.fullName,
    idNumber: updated.idNumber,
    batch: updated.batch,
    qrCodeData: updated.qrCodeData,
    idCardUrl: updated.idCardUrl,
    phone: updated.phone,
    address: updated.address,
    cnic: updated.cnic,
    status: updated.status,
    enrollmentDate: updated.enrollmentDate.toISOString(),
    createdAt: updated.createdAt.toISOString(),
  });
});

// Get student by ID
router.get("/students/:id", async (req, res) => {
  const [student] = await db
    .select({
      id: studentsTable.id,
      email: studentsTable.email,
      fullName: studentsTable.fullName,
      idNumber: studentsTable.idNumber,
      batch: studentsTable.batch,
      qrCodeData: studentsTable.qrCodeData,
      idCardUrl: studentsTable.idCardUrl,
      phone: studentsTable.phone,
      address: studentsTable.address,
      cnic: studentsTable.cnic,
      status: studentsTable.status,
      enrollmentDate: studentsTable.enrollmentDate,
      createdAt: studentsTable.createdAt,
    })
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
    id: student.id,
    email: student.email,
    fullName: student.fullName,
    idNumber: student.idNumber,
    batch: student.batch,
    qrCodeData: student.qrCodeData,
    idCardUrl: student.idCardUrl,
    phone: student.phone,
    address: student.address,
    cnic: student.cnic,
    status: student.status,
    enrollmentDate: student.enrollmentDate.toISOString(),
    createdAt: student.createdAt.toISOString(),
  });
});

// Get student by email
router.get("/students/by-email/:email", async (req, res) => {
  const [student] = await db
    .select({
      id: studentsTable.id,
      email: studentsTable.email,
      fullName: studentsTable.fullName,
      idNumber: studentsTable.idNumber,
      batch: studentsTable.batch,
      qrCodeData: studentsTable.qrCodeData,
      idCardUrl: studentsTable.idCardUrl,
      phone: studentsTable.phone,
      address: studentsTable.address,
      cnic: studentsTable.cnic,
      status: studentsTable.status,
      enrollmentDate: studentsTable.enrollmentDate,
      createdAt: studentsTable.createdAt,
    })
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

router.get("/students/:id/id-card.pdf", async (req, res) => {
  const auth = await getAuthContext(req);
  if (!auth) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [student] = await db
    .select({
      id: studentsTable.id,
      studentId: studentsTable.id,
      fullName: studentsTable.fullName,
      idNumber: studentsTable.idNumber,
      batch: studentsTable.batch,
      email: studentsTable.email,
      enrollmentDate: studentsTable.enrollmentDate,
      idCardPdf: studentsTable.idCardPdf,
      idCardPdfFileName: studentsTable.idCardPdfFileName,
    })
    .from(studentsTable)
    .where(eq(studentsTable.id, req.params.id))
    .limit(1);

  if (!student) {
    res.status(404).json({ error: "Student not found" });
    return;
  }

  if (auth.role === "student" && auth.studentId !== student.studentId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const fileName = student.idCardPdfFileName ?? `ID-Card-${student.idNumber}.pdf`;

  const rawPdf = student.idCardPdf as unknown;

  let pdfBuffer: Buffer;
  if (rawPdf && Buffer.isBuffer(rawPdf)) {
    pdfBuffer = rawPdf;
  } else if (rawPdf && rawPdf instanceof Uint8Array) {
    pdfBuffer = Buffer.from(rawPdf);
  } else {
    pdfBuffer = await buildIdCardPdfBuffer({
      fullName: student.fullName,
      idNumber: student.idNumber,
      batch: student.batch,
      email: student.email,
      enrollmentDate: student.enrollmentDate,
    });

    const idCardUrl = await uploadPdfToSupabase({
      bucketName: "id-cards",
      objectPath: `students/${student.idNumber}/id-card.pdf`,
      buffer: pdfBuffer,
    });

    await db
      .update(studentsTable)
      .set({ idCardPdf: pdfBuffer, idCardPdfFileName: fileName, idCardUrl })
      .where(eq(studentsTable.id, student.id));
  }

  res.setHeader("content-type", "application/pdf");
  res.setHeader("content-disposition", `attachment; filename="${fileName}"`);
  res.send(pdfBuffer);
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

router.post("/students/import-id-cards", async (req, res) => {
  const auth = await getAuthContext(req);
  if (!auth) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  if (auth.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  try {
    const summary = await processIdCardDirectory();
    res.json(summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to import ID cards";
    console.error("Failed to import ID cards and invoices:", error);
    res.status(500).json({ error: message });
  }
});

export default router;
