import { db, studentsTable, adminsTable, attendanceTable, paymentsTable, invoicesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

async function seed() {
  console.log("Seeding database...");

  // Admins
  await db.insert(adminsTable).values([
    { email: "admin@iiecs.edu", fullName: "System Administrator", role: "admin" },
    { email: "teacher@iiecs.edu", fullName: "Dr. Khalid Mehmood", role: "teacher" },
  ]).onConflictDoNothing();

  // Students
  const batch = "Batch B - C/C++ Algorithms";
  const studentData = [
    { email: "ali.hassan@student.iiecs.edu", fullName: "Ali Hassan", idNumber: "IIECS-2024-B-001" },
    { email: "fatima.malik@student.iiecs.edu", fullName: "Fatima Malik", idNumber: "IIECS-2024-B-002" },
    { email: "usman.khan@student.iiecs.edu", fullName: "Usman Khan", idNumber: "IIECS-2024-B-003" },
    { email: "ayesha.tariq@student.iiecs.edu", fullName: "Ayesha Tariq", idNumber: "IIECS-2024-B-004" },
    { email: "hamza.raza@student.iiecs.edu", fullName: "Hamza Raza", idNumber: "IIECS-2024-B-005" },
    { email: "zara.iqbal@student.iiecs.edu", fullName: "Zara Iqbal", idNumber: "IIECS-2024-B-006" },
    { email: "bilal.ahmed@student.iiecs.edu", fullName: "Bilal Ahmed", idNumber: "IIECS-2024-B-007" },
    { email: "sana.nasir@student.iiecs.edu", fullName: "Sana Nasir", idNumber: "IIECS-2024-B-008" },
  ];

  const inserted: { id: string; fullName: string; email: string; idNumber: string; batch: string; enrollmentDate: Date }[] = [];

  for (const s of studentData) {
    const existing = await db.select().from(studentsTable).where(eq(studentsTable.email, s.email)).limit(1);
    if (existing[0]) { inserted.push(existing[0]); continue; }

    const [student] = await db.insert(studentsTable).values({
      ...s, batch, qrCodeData: "", phone: "+92-300-0000000", status: "active",
    }).returning();

    const qr = JSON.stringify({
      id: student.id, name: student.fullName, email: student.email,
      idNumber: student.idNumber, batch: student.batch,
      enrollmentDate: student.enrollmentDate.toISOString().split("T")[0],
    });
    const [updated] = await db.update(studentsTable).set({ qrCodeData: qr }).where(eq(studentsTable.id, student.id)).returning();
    inserted.push(updated);
    console.log(`  Created student: ${updated.fullName}`);
  }

  // Attendance — last 14 weekdays
  const statuses = ["present", "present", "present", "late", "absent"] as const;
  const now = new Date();
  for (let d = 13; d >= 0; d--) {
    const date = new Date(now);
    date.setDate(date.getDate() - d);
    const dow = date.getDay();
    if (dow === 0 || dow === 6) continue;
    const dateStr = date.toISOString().split("T")[0];

    for (const student of inserted) {
      const ex = await db.select().from(attendanceTable)
        .where(and(eq(attendanceTable.studentId, student.id), eq(attendanceTable.attendanceDate, dateStr))).limit(1);
      if (ex[0]) continue;

      const status = statuses[Math.floor(Math.random() * statuses.length)];
      await db.insert(attendanceTable).values({
        studentId: student.id, attendanceDate: dateStr,
        checkInTime: new Date(`${dateStr}T09:${String(Math.floor(Math.random() * 30)).padStart(2, "0")}:00Z`),
        status,
      });
    }
  }
  console.log("  Attendance records created");

  // Payments + Invoices
  for (const student of inserted) {
    const ex = await db.select().from(paymentsTable).where(eq(paymentsTable.studentId, student.id)).limit(1);
    if (ex[0]) continue;

    const isPaid = Math.random() > 0.4;
    const [payment] = await db.insert(paymentsTable).values({
      studentId: student.id,
      amount: "50000",
      description: "Course Fee - IIECS-101 (Semester 1)",
      dueDate: "2025-01-31",
      status: isPaid ? "paid" : Math.random() > 0.5 ? "pending" : "overdue",
      paidDate: isPaid ? "2025-01-15" : null,
      paymentMethod: isPaid ? "Bank Transfer" : null,
      referenceNumber: isPaid ? `TXN-${Date.now()}-${Math.floor(Math.random() * 9999)}` : null,
    }).returning();

    if (isPaid) {
      const invCount = await db.select().from(invoicesTable).where(eq(invoicesTable.studentId, student.id));
      const invoiceNum = `INV-202501-${String(invCount.length + 1).padStart(4, "0")}`;
      await db.insert(invoicesTable).values({
        studentId: student.id, paymentId: payment.id,
        invoiceNumber: invoiceNum, amount: "50000",
        dueDate: "2025-01-31", status: "paid",
      }).onConflictDoNothing();
      console.log(`  Invoice: ${invoiceNum} for ${student.fullName}`);
    }
  }

  console.log("Seed complete!");
  process.exit(0);
}

seed().catch((err) => { console.error("Seed failed:", err); process.exit(1); });
