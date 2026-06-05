import { db, studentsTable } from "@workspace/db";

async function run() {
  const students = await db.select({
    id: studentsTable.id,
    idNumber: studentsTable.idNumber,
    fullName: studentsTable.fullName,
    qrCodeData: studentsTable.qrCodeData,
  }).from(studentsTable);
  
  console.log("All DB Students:");
  students.forEach(s => {
    console.log(`- ${s.idNumber}: ${s.fullName} (ID: ${s.id})`);
  });
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
