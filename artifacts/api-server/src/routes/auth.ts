import { Router } from "express";
import { db, adminsTable, studentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

const ADMIN_EMAILS = ["admin@iiecs.edu", "teacher@iiecs.edu"];

router.post("/auth/login", async (req, res) => {
  const { email } = req.body as { email?: string };
  if (!email) {
    res.status(400).json({ error: "Email is required" });
    return;
  }

  const normalizedEmail = email.toLowerCase().trim();

  if (ADMIN_EMAILS.includes(normalizedEmail)) {
    const [admin] = await db
      .select()
      .from(adminsTable)
      .where(eq(adminsTable.email, normalizedEmail))
      .limit(1);

    res.json({
      role: "admin",
      email: normalizedEmail,
      studentId: null,
      name: admin?.fullName ?? "Administrator",
    });
    return;
  }

  const [student] = await db
    .select()
    .from(studentsTable)
    .where(eq(studentsTable.email, normalizedEmail))
    .limit(1);

  if (!student) {
    res.status(401).json({ error: "Email not recognized. Contact admin." });
    return;
  }

  res.json({
    role: "student",
    email: normalizedEmail,
    studentId: student.id,
    name: student.fullName,
  });
});

router.post("/auth/logout", (_req, res) => {
  res.json({ success: true });
});

router.get("/auth/me", async (req, res) => {
  const email = req.headers["x-user-email"] as string | undefined;
  if (!email) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const normalizedEmail = email.toLowerCase().trim();

  if (ADMIN_EMAILS.includes(normalizedEmail)) {
    const [admin] = await db
      .select()
      .from(adminsTable)
      .where(eq(adminsTable.email, normalizedEmail))
      .limit(1);

    res.json({
      role: "admin",
      email: normalizedEmail,
      studentId: null,
      name: admin?.fullName ?? "Administrator",
    });
    return;
  }

  const [student] = await db
    .select()
    .from(studentsTable)
    .where(eq(studentsTable.email, normalizedEmail))
    .limit(1);

  if (!student) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  res.json({
    role: "student",
    email: normalizedEmail,
    studentId: student.id,
    name: student.fullName,
  });
});

export default router;
