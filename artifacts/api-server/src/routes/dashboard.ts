import { Router } from "express";
import { db, studentsTable, attendanceTable, paymentsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router = Router();

router.get("/dashboard/stats", async (_req, res) => {
  const today = new Date().toISOString().split("T")[0];

  const students = await db.select({ id: studentsTable.id }).from(studentsTable);
  const totalStudents = students.length;

  const todayAttendance = await db
    .select({ status: attendanceTable.status })
    .from(attendanceTable)
    .where(eq(attendanceTable.attendanceDate, today));

  const presentToday = todayAttendance.filter(
    (r) => r.status === "present" || r.status === "late",
  ).length;
  const absentToday = todayAttendance.filter((r) => r.status === "absent").length;

  const allPayments = await db
    .select({ status: paymentsTable.status, amount: paymentsTable.amount })
    .from(paymentsTable);

  const pendingPayments = allPayments.filter((p) => p.status === "pending").length;
  const overduePayments = allPayments.filter((p) => p.status === "overdue").length;
  const totalPaidAmount = allPayments
    .filter((p) => p.status === "paid")
    .reduce((s, p) => s + parseFloat(p.amount), 0);
  const totalPendingAmount = allPayments
    .filter((p) => p.status === "pending" || p.status === "overdue")
    .reduce((s, p) => s + parseFloat(p.amount), 0);

  const allAttendance = await db
    .select({ status: attendanceTable.status })
    .from(attendanceTable);
  const totalRecords = allAttendance.length;
  const presentRecords = allAttendance.filter(
    (r) => r.status === "present" || r.status === "late",
  ).length;
  const attendanceRate =
    totalRecords > 0 ? Math.round((presentRecords / totalRecords) * 10000) / 100 : 0;

  res.json({
    totalStudents,
    presentToday,
    absentToday,
    pendingPayments,
    overduePayments,
    totalPaidAmount,
    totalPendingAmount,
    attendanceRate,
  });
});

export default router;
