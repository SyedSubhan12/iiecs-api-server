import { db, attendanceTable, paymentsTable, invoicesTable } from "@workspace/db";
import { sql } from "drizzle-orm";

async function run() {
  const args = process.argv.slice(2);
  const audit = args.includes("--audit");
  const clearAttendance = args.includes("--attendance") || args.includes("--all") || args.length === 0;
  const clearPayments = args.includes("--payments") || args.includes("--all");
  const clearInvoices = args.includes("--invoices") || args.includes("--all");

  if (args.includes("--help") || args.includes("-h")) {
    console.log("Usage: tsx clear_attendance.ts [--audit] [--attendance] [--payments] [--invoices] [--all]");
    console.log("  --audit       Print current row counts and exit");
    console.log("  --attendance  Delete all attendance rows (default when no flags provided)");
    console.log("  --payments    Delete all payment rows");
    console.log("  --invoices    Delete all invoice rows");
    console.log("  --all         Delete invoices, payments, and attendance");
    process.exit(0);
  }

  if (audit) {
    const [a] = await db.select({ count: sql<number>`count(*)` }).from(attendanceTable);
    const [p] = await db.select({ count: sql<number>`count(*)` }).from(paymentsTable);
    const [i] = await db.select({ count: sql<number>`count(*)` }).from(invoicesTable);
    console.log("Row counts:", {
      attendance: a?.count ?? 0,
      payments: p?.count ?? 0,
      invoices: i?.count ?? 0,
    });
    process.exit(0);
  }

  if (clearInvoices) {
    console.log("Clearing all invoices...");
    await db.delete(invoicesTable);
    console.log("Invoices table emptied.");
  }

  if (clearPayments) {
    console.log("Clearing all payments...");
    await db.delete(paymentsTable);
    console.log("Payments table emptied.");
  }

  if (clearAttendance) {
    console.log("Clearing all attendance records...");
    await db.delete(attendanceTable);
    console.log("Attendance table emptied.");
  }

  process.exit(0);
}

run().catch((err) => {
  console.error("Failed to clear data:", err);
  process.exit(1);
});
