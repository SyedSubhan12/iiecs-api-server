import { db, studentsTable } from "@workspace/db";

async function inspect() {
  console.log("Fetching students from database...");
  const students = await db.select({
    id: studentsTable.id,
    fullName: studentsTable.fullName,
    idNumber: studentsTable.idNumber,
    email: studentsTable.email,
    qrCodeData: studentsTable.qrCodeData,
  }).from(studentsTable);
  
  console.log(`Found ${students.length} students in database.`);
  console.log("Sample student records:");
  console.log(JSON.stringify(students.slice(0, 5), null, 2));
  
  process.exit(0);
}

inspect().catch(err => {
  console.error(err);
  process.exit(1);
});
