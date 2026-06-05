// scripts/src/remove_all_invoices.ts
// WARNING: This script irreversibly deletes ALL invoice records from the database.
// Use with caution and only in a controlled environment (e.g., after migration to new template).

import { db } from "../../lib/db/src/index";
import { sql } from "drizzle-orm";
import { invoicesTable } from "../../lib/db/src/schema/invoices";

async function deleteAllInvoices() {
  try {
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(invoicesTable);
    const count = Number(countResult[0]?.count ?? 0);
    console.log(`Found ${count} invoices. Deleting all...`);
    await db.delete(invoicesTable);
    console.log("All invoices have been removed.");
  } catch (err) {
    console.error("Error deleting invoices:", err);
    process.exit(1);
  }
}

deleteAllInvoices().then(() => process.exit(0));
