import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function uploadLogo() {
  const filePath = path.resolve(__dirname, "../../logo-bot.jpeg");
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    return;
  }

  const fileBuffer = fs.readFileSync(filePath);
  const bucketName = "id-cards";

  // Check if bucket exists, if not create it
  const { data: buckets } = await supabase.storage.listBuckets();
  const bucketExists = buckets?.some(b => b.name === bucketName);

  if (!bucketExists) {
    console.log(`Creating bucket: ${bucketName}`);
    await supabase.storage.createBucket(bucketName, { public: true });
  }

  console.log(`Uploading logo to bucket: ${bucketName}...`);
  const { data, error } = await supabase.storage.from(bucketName).upload("logo-bot.jpeg", fileBuffer, {
    contentType: "image/jpeg",
    upsert: true
  });

  if (error) {
    console.error("Upload error:", error);
    return;
  }

  const { data: { publicUrl } } = supabase.storage.from(bucketName).getPublicUrl("logo-bot.jpeg");
  console.log("Logo uploaded successfully!");
  console.log("Public URL:", publicUrl);
}

uploadLogo().catch(console.error);
