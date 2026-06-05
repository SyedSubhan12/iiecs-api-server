import { db, studentsTable, adminsTable, attendanceTable, paymentsTable, invoicesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";

// Helper to derive name and ID from filename
function cleanName(filename: string): { idNumber: string; fullName: string } | null {
  const namePart = filename.endsWith(".pdf") ? filename.slice(0, -4) : filename;
  const parts = namePart.split("_");
  
  let idIndex = -1;
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].startsWith("IIECS-")) {
      idIndex = i;
      break;
    }
  }
  
  if (idIndex === -1) return null;
  
  const idNumber = parts[idIndex];
  const nameParts = parts.slice(idIndex + 1);
  
  const cleanedParts: string[] = [];
  for (const part of nameParts) {
    let p = part.replace(/\(.*?\)/g, "").replace(/\d+/g, "").trim();
    if (p) {
      cleanedParts.push(p);
    }
  }
  
  let nameStr = cleanedParts.join(" ");
  nameStr = nameStr.replace(/\bmuha\s+mmad\b/gi, "Muhammad");
  nameStr = nameStr.replace(/\s+/g, " ").trim();
  
  const words = nameStr.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  
  // Deduplicate adjacent words
  const dedup: string[] = [];
  for (const w of words) {
    if (dedup.length === 0 || w.toLowerCase() !== dedup[dedup.length - 1].toLowerCase()) {
      dedup.push(w);
    }
  }
  
  // Deduplicate repeated halves
  const n = dedup.length;
  if (n % 2 === 0) {
    const half = n / 2;
    let match = true;
    for (let i = 0; i < half; i++) {
      if (dedup[i].toLowerCase() !== dedup[half + i].toLowerCase()) {
        match = false;
        break;
      }
    }
    if (match) {
      dedup.splice(half);
    }
  }
  
  return {
    idNumber,
    fullName: dedup.join(" "),
  };
}

function generateEmail(fullName: string): string {
  const parts = fullName.toLowerCase().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0]}.${parts[parts.length - 1]}@student.iiecs.edu`;
  }
  return `${parts[0]}@student.iiecs.edu`;
}

async function seed() {
  const args = process.argv.slice(2);
  const reset = args.includes("--reset");
  
  if (args.includes("--help") || args.includes("-h")) {
    console.log("Usage: tsx seed.ts [--reset] [--help|-h]");
    console.log("  --reset          Delete existing students/attendance/payments/invoices before seeding");
    console.log("  --help, -h       Show this help message");
    process.exit(0);
  }

  console.log("Seeding database...");

  if (reset) {
    console.log("Reset enabled: cleaning up existing database tables...");
    await db.delete(invoicesTable);
    await db.delete(paymentsTable);
    await db.delete(attendanceTable);
    await db.delete(studentsTable);
  }

  // Seed Admins
  console.log("Seeding admins...");
  await db.insert(adminsTable).values([
    { email: "admin@iiecs.edu", fullName: "System Administrator", role: "admin" },
    { email: "teacher@iiecs.edu", fullName: "Dr. Khalid Mehmood", role: "teacher" },
  ]).onConflictDoNothing();

  // Read ID Card files
  let idCardsDir = path.resolve(process.cwd(), "id_Cards");
  if (!fs.existsSync(idCardsDir)) {
    idCardsDir = path.resolve(process.cwd(), "..", "id_Cards");
  }

  if (!fs.existsSync(idCardsDir)) {
    console.error(`Error: 'id_Cards' directory not found at process.cwd() or parent.`);
    process.exit(1);
  }

  const files = fs.readdirSync(idCardsDir).filter(f => f.endsWith(".pdf"));
  console.log(`Found ${files.length} ID card files. Processing...`);

  const batch = "Batch A - C/C++ Algorithms";
  const inserted: any[] = [];

  for (const file of files) {
    const parsed = cleanName(file);
    if (!parsed) {
      console.warn(`  Skipping file (unrecognized name pattern): ${file}`);
      continue;
    }

    const { idNumber, fullName } = parsed;
    const email = generateEmail(fullName);
    const filePath = path.join(idCardsDir, file);
    const fileBuffer = fs.readFileSync(filePath);

    const phone = `+92-300-${Math.floor(1000000 + Math.random() * 9000000)}`;
    const cnic = `42101-${Math.floor(1000000 + Math.random() * 9000000)}-${Math.floor(1 + Math.random() * 9)}`;

    const [existing] = await db
      .select()
      .from(studentsTable)
      .where(eq(studentsTable.idNumber, idNumber))
      .limit(1);

    const student = existing
      ? (
          await db
            .update(studentsTable)
            .set({
              email,
              fullName,
              batch,
              idCardUrl: null,
              idCardPdf: fileBuffer,
              idCardPdfFileName: file,
              phone,
              cnic,
              address: "Karachi, Pakistan",
              status: "active",
            })
            .where(eq(studentsTable.id, existing.id))
            .returning()
        )[0]
      : (
          await db
            .insert(studentsTable)
            .values({
              email,
              fullName,
              idNumber,
              batch,
              idCardUrl: null,
              idCardPdf: fileBuffer,
              idCardPdfFileName: file,
              phone,
              cnic,
              address: "Karachi, Pakistan",
              status: "active",
            })
            .returning()
        )[0];

    const qr = JSON.stringify({
      id: student.id,
      name: student.fullName,
      email: student.email,
      idNumber: student.idNumber,
      batch: student.batch,
      enrollmentDate: student.enrollmentDate.toISOString().split("T")[0],
    });

    const [updated] = await db.update(studentsTable).set({ qrCodeData: qr }).where(eq(studentsTable.id, student.id)).returning();
    inserted.push(updated);
    console.log(`  Created student: ${updated.fullName} with ID ${updated.idNumber}`);
  }

  
  console.log("Seed complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
