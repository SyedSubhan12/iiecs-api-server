import { Router } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import studentsRouter from "./students.js";
import attendanceRouter from "./attendance.js";
import paymentsRouter from "./payments.js";
import invoicesRouter from "./invoices.js";
import dashboardRouter from "./dashboard.js";

const router = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(studentsRouter);
router.use(attendanceRouter);
router.use("/payments", paymentsRouter);
router.use(invoicesRouter);
router.use(dashboardRouter);

export default router;
