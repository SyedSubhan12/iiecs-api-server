import { db, invoicesTable } from "@workspace/db";

/**
 * Delete all invoices from the database.
 * This script should be run by an admin in a controlled environment.
 */
async function deleteAllInvoices() {
  try {
    const deleted = await db.delete(invoicesTable).returning({ id: invoicesTable.id });
    console.log(`Deleted ${deleted.length} invoices.`);
  } catch (error) {
    console.error("Failed to delete invoices:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  deleteAllInvoices();
}
