import { db, invoicesTable } from "@workspace/db";

async function main() {
  const allInvoices = await db.select().from(invoicesTable);
  console.log(`Found ${allInvoices.length} invoices in database.`);
  if (allInvoices.length > 0) {
    console.log("Sample invoices:", JSON.stringify(allInvoices.slice(0, 5), null, 2));
  }
}

main().catch(console.error);
