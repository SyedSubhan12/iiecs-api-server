import * as dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

async function main() {
  try {
    const apiBase = process.env.API_BASE_URL ?? "http://localhost:3000/api";
    const response = await fetch(`${apiBase}/students/import-id-cards`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-user-email": process.env.ADMIN_EMAIL ?? "admin@iiecs.edu",
      },
    });

    const payload: any = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.error || `Request failed with ${response.status}`);
    }

    console.log(JSON.stringify(payload, null, 2));
  } catch (error) {
    console.error("ID card import failed:", error);
    process.exit(1);
  }
}

main();
