import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let supabaseClient: SupabaseClient | null = null;

function getSupabaseClient() {
  if (supabaseClient) return supabaseClient;

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured");
  }

  supabaseClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  return supabaseClient;
}

async function ensurePublicBucket(bucketName: string) {
  const supabase = getSupabaseClient();
  const { data: buckets, error } = await supabase.storage.listBuckets();

  if (error) {
    throw new Error(`Failed to list Supabase buckets: ${error.message}`);
  }

  if (!buckets?.some((bucket: { name: string }) => bucket.name === bucketName)) {
    const { error: createError } = await supabase.storage.createBucket(bucketName, {
      public: true,
    });

    if (createError) {
      throw new Error(`Failed to create Supabase bucket "${bucketName}": ${createError.message}`);
    }
  }
}

async function uploadPdfToSupabase(params: {
  bucketName: string;
  objectPath: string;
  buffer: Buffer;
}) {
  const supabase = getSupabaseClient();
  await ensurePublicBucket(params.bucketName);

  const { error } = await supabase.storage.from(params.bucketName).upload(params.objectPath, params.buffer, {
    contentType: "application/pdf",
    upsert: true,
  });

  if (error) {
    throw new Error(`Failed to upload ${params.objectPath} to Supabase: ${error.message}`);
  }

  const { data } = supabase.storage.from(params.bucketName).getPublicUrl(params.objectPath);
  return data.publicUrl;
}

export { getSupabaseClient, ensurePublicBucket, uploadPdfToSupabase };
