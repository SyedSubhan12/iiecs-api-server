import { db, studentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

async function run() {
  const [student] = await db
    .select()
    .from(studentsTable)
    .where(eq(studentsTable.idNumber, "IIECS-001"))
    .limit(1);
  
  if (!student) {
    console.log("Student IIECS-001 not found by exact query 'IIECS-001'!");
    
    // Find it by like
    console.log("Searching with LIKE...");
    const matches = await db.select().from(studentsTable);
    const m = matches.find(s => s.idNumber.includes("001"));
    if (m) {
      console.log("Found match via find:", {
        id: m.id,
        idNumber: JSON.stringify(m.idNumber),
        idNumberLen: m.idNumber.length,
        fullName: m.fullName,
        qrCodeData: m.qrCodeData,
      });
    } else {
      console.log("No student containing '001' found in DB.");
    }
  } else {
    console.log("Student IIECS-001 found directly!", {
      id: student.id,
      idNumber: JSON.stringify(student.idNumber),
      idNumberLen: student.idNumber.length,
      fullName: student.fullName,
      qrCodeData: student.qrCodeData,
    });
  }
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
