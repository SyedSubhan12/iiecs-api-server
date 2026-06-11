import { Router } from "express";
import { db, paymentsTable, studentsTable, invoicesTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import * as XLSX from "xlsx";

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
    .select()
    .from(studentsTable)
    .where(eq(studentsTable.email, email))
    .limit(1);

  if (student) {
    return { role: "student", email, studentId: student.id };
  }

  return null;
}

const router = Router();
const FIXED_STUDENT_FEE_PKR = 2000;

// List payments
router.get("/", async (req, res) => {
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
router.post("/", async (req, res) => {
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

// Export payments to Excel
router.get("/excel-export", async (req, res) => {
  console.log("[DEBUG] Entered /payments/excel-export handler");
  try {
    const auth = await getAuthContext(req);
    if (!auth || auth.role !== "admin") {
      res.status(403).json({ error: "Admin access required" });
      return;
    }

    // Fetch from both tables to be comprehensive, or just invoices if that's the primary fee record
    const invoiceRows = await db
      .select({
        studentName: studentsTable.fullName,
        studentId: studentsTable.idNumber,
        amount: invoicesTable.amount,
        status: invoicesTable.status,
        dueDate: invoicesTable.dueDate,
        createdAt: invoicesTable.createdAt,
      })
      .from(invoicesTable)
      .innerJoin(studentsTable, eq(invoicesTable.studentId, studentsTable.id));

    const paymentRows = await db
      .select({
        studentName: studentsTable.fullName,
        studentId: studentsTable.idNumber,
        amount: paymentsTable.amount,
        status: paymentsTable.status,
        dueDate: paymentsTable.dueDate,
        createdAt: paymentsTable.createdAt,
      })
      .from(paymentsTable)
      .innerJoin(studentsTable, eq(paymentsTable.studentId, studentsTable.id));

    // Combine and deduplicate if necessary, or just list both. 
    // Usually invoices are the "fee" record.
    const combinedData = [...invoiceRows, ...paymentRows];

    const data = combinedData.map((r) => {
      // Extract month from dueDate (YYYY-MM-DD) or createdAt
      let month = "N/A";
      if (r.dueDate) {
        month = r.dueDate.substring(0, 7); // YYYY-MM
      } else {
        month = r.createdAt.toISOString().substring(0, 7);
      }

      return {
        "Student Name": r.studentName,
        "Student ID": r.studentId,
        "Month": month,
        "Fees": r.status === "paid" ? "Paid" : "Unpaid",
        "Amount (PKR)": parseFloat(r.amount),
      };
    });

    if (data.length === 0) {
      // Add a placeholder row if no data, so the file isn't completely "corrupt" or confusing
      data.push({
        "Student Name": "No records found",
        "Student ID": "-",
        "Month": "-",
        "Fees": "-",
        "Amount (PKR)": 0,
      });
    }

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Fee Status");

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="Student_Fees_Export.xlsx"',
    );
    res.send(buffer);
  } catch (error) {
    console.error("Export failed:", error);
    res.status(500).json({ error: "Failed to export payments" });
  }
});

// Get payment
router.get("/:id", async (req, res) => {
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
router.patch("/:id", async (req, res) => {
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
      ...(body.status !== undefined && body.status !== "paid" && { paidDate: null }),
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
router.delete("/:id", async (req, res) => {
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
router.delete("/", async (req, res) => {
  try {
    const auth = await getAuthContext(req);
    if (!auth) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    if (auth.role !== "admin") {
      res.status(403).json({ error: "Unauthorized - Admin access required" });
      return;
    }

    // Delete all payments
    const paymentResult = await db.delete(paymentsTable).returning({ id: paymentsTable.id });
    
    // Also delete all invoices that reference the deleted payments
    const invoiceResult = await db.delete(invoicesTable).where(
      sql`${invoicesTable.paymentId} = ANY(${sql`${paymentResult.map(p => p.id).join(', ')}`})`
    ).returning({ id: invoicesTable.id });

    res.json({ 
      deletedPayments: paymentResult.length, 
      deletedInvoices: invoiceResult.length,
      totalDeleted: paymentResult.length + invoiceResult.length 
    });
  } catch (error) {
    console.error("Error deleting all payments and invoices:", error);
    res.status(500).json({ error: "Failed to delete payments and invoices" });
  }
});

// Delete all invoices (admin only)
router.delete("/invoices", async (req, res) => {
  try {
    const auth = await getAuthContext(req);
    if (!auth || auth.role !== "admin") {
      res.status(403).json({ error: "Admin access required" });
      return;
    }

    const deleted = await db
      .delete(invoicesTable)
      .returning({ id: invoicesTable.id });

    console.warn(
      `[SECURITY] Admin ${auth.email} deleted ${deleted.length} invoices`,
    );

    res.json({ deletedInvoices: deleted.length });
  } catch (error) {
    console.error("Bulk invoice deletion failed:", error);
    res.status(500).json({ error: "Failed to delete invoices" });
  }
});

export default router;
