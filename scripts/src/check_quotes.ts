import { db, studentsTable } from "@workspace/db";

async function run() {
  const students = await db.select({
    idNumber: studentsTable.idNumber,
    fullName: studentsTable.fullName,
  }).from(studentsTable);
  
  students.forEach(s => {
    console.log(`Student: ${s.fullName}`);
    console.log(`  idNumber raw:    ${s.idNumber}`);
    console.log(`  idNumber length: ${s.idNumber.length}`);
    console.log(`  starts with ":   ${s.idNumber.startsWith('"')}`);
    console.log(`  ends with ":     ${s.idNumber.endsWith('"')}`);
  });
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
