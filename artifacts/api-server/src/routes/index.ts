import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import studentsRouter from "./students";
import attendanceRouter from "./attendance";
import paymentsRouter from "./payments";
import invoicesRouter from "./invoices";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(studentsRouter);
router.use(attendanceRouter);
router.use(paymentsRouter);
router.use(invoicesRouter);
router.use(dashboardRouter);

export default router;
