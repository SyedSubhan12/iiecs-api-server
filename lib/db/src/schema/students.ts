import { pgTable, text, timestamp, uuid, customType } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

const bytea = customType<{ data: Buffer | null; driverData: Buffer | null }>({
  dataType() {
    return "bytea";
  },
});

export const studentsTable = pgTable("students", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").unique().notNull(),
  fullName: text("full_name").notNull(),
  idNumber: text("id_number").unique().notNull(),
  batch: text("batch").notNull(),
  qrCodeData: text("qr_code_data"),
  idCardUrl: text("id_card_url"),
  idCardPdf: bytea("id_card_pdf"),
  idCardPdfFileName: text("id_card_pdf_file_name"),
  phone: text("phone"),
  address: text("address"),
  cnic: text("cnic"),
  status: text("status").notNull().default("active"),
  enrollmentDate: timestamp("enrollment_date", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertStudentSchema = createInsertSchema(studentsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertStudent = z.infer<typeof insertStudentSchema>;
export type Student = typeof studentsTable.$inferSelect;
