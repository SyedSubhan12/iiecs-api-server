import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.warn(
    "⚠️ DATABASE_URL is not set. Database queries will fail. " +
    "Please set DATABASE_URL in your environment variables.",
  );
}

export const pool = new Pool({ 
  connectionString: databaseUrl || "postgres://unused:unused@localhost:5432/unused" 
});
export const db = drizzle(pool, { schema });

export * from "./schema";
