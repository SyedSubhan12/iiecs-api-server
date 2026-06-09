import fs from "fs/promises";
import path from "path";
import { format } from "date-fns";
import { and, eq, like } from "drizzle-orm";
import { fileURLToPath } from "url";
import { db, invoicesTable, studentsTable } from "@workspace/db";
import { buildInvoicePdfBuffer } from "../routes/invoices.js";
import { uploadPdfToSupabase } from "./supabase-storage.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ID_CARDS_DIR = path.resolve(__dirname, "../../../../id_Cards");
const ID_CARDS_BUCKET = "id-cards";
const INVOICES_BUCKET = "invoices";
const DEFAULT_BATCH = "Batch B - C/C++ Algorithms";
const DEFAULT_FEE_PKR = 2000;

type ImportSummary = {
  scanned: number;
  processed: number;
  createdStudents: number;
  updatedStudents: number;
  createdInvoices: number;
  uploadedIdCards: number;
  uploadedInvoices: number;
  skipped: Array<{ fileName: string; reason: string }>;
  students: Array<{
    id: string;
    idNumber: string;
    fullName: string;
    email: string;
    idCardUrl: string | null;
    invoiceId: string | null;
    invoiceNumber: string | null;
    invoicePdfUrl: string | null;
  }>;
};

function slugifyName(fullName: string) {
  return fullName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .replace(/\.{2,}/g, ".");
}

function buildStudentEmail(fullName: string, idNumber: string) {
  const slug = slugifyName(fullName);
  return `${slug || idNumber.toLowerCase().replace(/[^a-z0-9]+/g, "")}@iiecs.edu`;
}

function parseIdCardFileName(fileName: string) {
  const match = fileName.match(/^IIECS_ID_IIECS-(\d+?)_(.+)\.pdf$/i);
  if (!match) return null;

  const numericId = match[1];
  const idNumber = `IIECS-${numericId.padStart(3, "0")}`;
  const rawName = match[2]
    .replace(/_/g, " ")
    .replace(/\s*\(\d+\)\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return {
    idNumber,
    fullName: rawName,
    email: buildStudentEmail(rawName, idNumber),
  };
}

async function upsertStudentForIdCard(input: {
  idNumber: string;
  fullName: string;
  email: string;
  fileName: string;
  pdfBuffer: Buffer;
}) {
  const [existing] = await db
    .select()
    .from(studentsTable)
    .where(eq(studentsTable.idNumber, input.idNumber))
    .limit(1);

  const qrPayload = existing
    ? {
        id: existing.id,
        name: input.fullName,
        email: input.email,
        idNumber: input.idNumber,
        batch: existing.batch,
        enrollmentDate: existing.enrollmentDate.toISOString().split("T")[0],
      }
    : null;

  const studentRecord = existing
    ? (
        await db
          .update(studentsTable)
          .set({
            fullName: input.fullName,
            email: input.email.toLowerCase().trim(),
            batch: existing.batch || DEFAULT_BATCH,
            qrCodeData: JSON.stringify(qrPayload),
            idCardPdf: input.pdfBuffer,
            idCardPdfFileName: input.fileName,
          })
          .where(eq(studentsTable.id, existing.id))
          .returning()
      )[0]
    : (
        await db
          .insert(studentsTable)
          .values({
            email: input.email.toLowerCase().trim(),
            fullName: input.fullName,
            idNumber: input.idNumber,
            batch: DEFAULT_BATCH,
            qrCodeData: "",
            idCardPdf: input.pdfBuffer,
            idCardPdfFileName: input.fileName,
          })
          .returning()
      )[0];

  const updatedQr = JSON.stringify({
    id: studentRecord.id,
    name: input.fullName,
    email: studentRecord.email,
    idNumber: input.idNumber,
    batch: studentRecord.batch,
    enrollmentDate: studentRecord.enrollmentDate.toISOString().split("T")[0],
  });

  const [finalStudent] = await db
    .update(studentsTable)
    .set({ qrCodeData: updatedQr })
    .where(eq(studentsTable.id, studentRecord.id))
    .returning();

  const idCardUrl = await uploadPdfToSupabase({
    bucketName: ID_CARDS_BUCKET,
    objectPath: `students/${input.idNumber}/id-card.pdf`,
    buffer: input.pdfBuffer,
  });

  const [savedStudent] = await db
    .update(studentsTable)
    .set({ idCardUrl, idCardPdf: input.pdfBuffer, idCardPdfFileName: input.fileName })
    .where(eq(studentsTable.id, finalStudent.id))
    .returning();

  return savedStudent;
}

async function ensureInvoiceForStudent(student: {
  id: string;
  fullName: string;
  idNumber: string;
  batch: string;
  email: string;
}) {
  const currentMonth = format(new Date(), "yyyy-MM");
  const invoicePrefix = `INV-${currentMonth.replace("-", "")}`;

  const [existingInvoice] = await db
    .select()
    .from(invoicesTable)
    .where(and(eq(invoicesTable.studentId, student.id), like(invoicesTable.invoiceNumber, `${invoicePrefix}%`)))
    .limit(1);

  let invoice = existingInvoice;
  let created = false;

  if (!invoice) {
    const rows = await db
      .select({ invoiceNumber: invoicesTable.invoiceNumber })
      .from(invoicesTable)
      .where(like(invoicesTable.invoiceNumber, `${invoicePrefix}%`));

    let maxSeq = 0;
    for (const row of rows) {
      const parts = row.invoiceNumber.split("-");
      const seq = Number(parts[parts.length - 1]);
      if (Number.isFinite(seq) && seq > maxSeq) {
        maxSeq = seq;
      }
    }

    [invoice] = await db
      .insert(invoicesTable)
      .values({
        studentId: student.id,
        invoiceNumber: `${invoicePrefix}-${String(maxSeq + 1).padStart(4, "0")}`,
        amount: DEFAULT_FEE_PKR.toString(),
        dueDate: format(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"),
        status: "unpaid",
      })
      .returning();
    created = true;
  }

  const pdfBuffer = await buildInvoicePdfBuffer({
    invoiceNumber: invoice.invoiceNumber,
    issuedDate: invoice.issuedDate,
    dueDate: invoice.dueDate ?? null,
    status: invoice.status,
    amountPkr: Number(invoice.amount) || DEFAULT_FEE_PKR,
    student,
  });

  const pdfUrl = await uploadPdfToSupabase({
    bucketName: INVOICES_BUCKET,
    objectPath: `invoices/${invoice.invoiceNumber}.pdf`,
    buffer: pdfBuffer,
  });

  const [savedInvoice] = await db
    .update(invoicesTable)
    .set({ pdfUrl })
    .where(eq(invoicesTable.id, invoice.id))
    .returning();

  return {
    created,
    invoiceId: savedInvoice.id,
    invoiceNumber: savedInvoice.invoiceNumber,
    invoicePdfUrl: savedInvoice.pdfUrl ?? pdfUrl,
  };
}

export async function processIdCardDirectory(): Promise<ImportSummary> {
  const files = await fs.readdir(ID_CARDS_DIR);
  const pdfFiles = files.filter((file) => file.toLowerCase().endsWith(".pdf")).sort();

  const summary: ImportSummary = {
    scanned: pdfFiles.length,
    processed: 0,
    createdStudents: 0,
    updatedStudents: 0,
    createdInvoices: 0,
    uploadedIdCards: 0,
    uploadedInvoices: 0,
    skipped: [],
    students: [],
  };

  for (const fileName of pdfFiles) {
    const parsed = parseIdCardFileName(fileName);
    if (!parsed) {
      summary.skipped.push({
        fileName,
        reason: "Filename does not match IIECS_ID_IIECS-###_Name.pdf",
      });
      continue;
    }

    const filePath = path.join(ID_CARDS_DIR, fileName);
    const pdfBuffer = await fs.readFile(filePath);

    const [existingStudent] = await db
      .select()
      .from(studentsTable)
      .where(eq(studentsTable.idNumber, parsed.idNumber))
      .limit(1);

    const student = await upsertStudentForIdCard({
      idNumber: parsed.idNumber,
      fullName: parsed.fullName,
      email: existingStudent?.email ?? parsed.email,
      fileName,
      pdfBuffer,
    });

    summary.processed += 1;
    if (existingStudent) summary.updatedStudents += 1;
    else summary.createdStudents += 1;
    summary.uploadedIdCards += 1;

    const invoiceInfo = await ensureInvoiceForStudent(student);
    if (invoiceInfo.created) summary.createdInvoices += 1;
    summary.uploadedInvoices += 1;

    summary.students.push({
      id: student.id,
      idNumber: student.idNumber,
      fullName: student.fullName,
      email: student.email,
      idCardUrl: student.idCardUrl,
      invoiceId: invoiceInfo.invoiceId,
      invoiceNumber: invoiceInfo.invoiceNumber,
      invoicePdfUrl: invoiceInfo.invoicePdfUrl,
    });
  }

  return summary;
}
