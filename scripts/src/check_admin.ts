import { db, adminsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

async function checkAdmin(email: string) {
  const admin = await db.select().from(adminsTable).where(eq(adminsTable.email, email)).limit(1);
  console.log("Admin record:", admin);
}

checkAdmin("admin@iiecs.edu").catch((e) => console.error(e));
