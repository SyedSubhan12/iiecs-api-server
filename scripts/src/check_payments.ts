import { db, paymentsTable } from "@workspace/db";

async function main() {
  const allPayments = await db.select().from(paymentsTable);
  console.log(`Found ${allPayments.length} payments in database.`);
  if (allPayments.length > 0) {
    console.log("Sample payments:", JSON.stringify(allPayments.slice(0, 5), null, 2));
  }
}

main().catch(console.error);
