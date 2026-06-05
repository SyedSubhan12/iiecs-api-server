import { db, invoicesTable } from "@workspace/db";

async function run() {
  try {
    const studentId = "c75177c7-f1c7-4e77-bfa9-63455dea4696";
    const invoiceNumber = "INV-202606-0002";
    
    console.log("Attempting insert...");
    const [invoice] = await db
      .insert(invoicesTable)
      .values({
        studentId,
        paymentId: null,
        invoiceNumber,
        amount: "2000",
        dueDate: null,
        status: "unpaid",
      })
      .returning();
      
    console.log("Success:", invoice);
  } catch (err: any) {
    console.error("FAILED WITH ERROR:");
    console.error(err);
  }
  process.exit(0);
}

run();
