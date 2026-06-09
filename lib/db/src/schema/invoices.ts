import { pgTable, text, timestamp, uuid, date, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { studentsTable } from "./students";
import { paymentsTable } from "./payments";

export const invoicesTable = pgTable("invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id").notNull().references(() => studentsTable.id, { onDelete: "cascade" }),
  paymentId: uuid("payment_id").references(() => paymentsTable.id, { onDelete: "set null" }),
  invoiceNumber: text("invoice_number").unique().notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  issuedDate: timestamp("issued_date", { withTimezone: true }).notNull().defaultNow(),
  dueDate: date("due_date", { mode: "string" }),
  status: text("status").notNull().default("unpaid"),
  pdfUrl: text("pdf_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertInvoiceSchema = createInsertSchema(invoicesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoicesTable.$inferSelect;
