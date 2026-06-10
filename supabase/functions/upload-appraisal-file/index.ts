// Server-side upload endpoint for appraisal attachments.
//
// Replaces direct anon writes to the `appraisals` bucket. The client uploads
// one file per request (multipart/form-data); this function validates MIME,
// extension, and size, then writes via the service-role key to a
// server-derived path so the caller cannot choose arbitrary keys.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUCKET = "appraisals";
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.oasis.opendocument.spreadsheet",
]);
const ALLOWED_EXT_RE = /\.(pdf|jpe?g|png|csv|xlsx?|ods)$/i;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function sanitizeFilename(name: string): string {
  const base = name.replace(/\\/g, "/").split("/").pop() ?? "file";
  return base.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120) || "file";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonResponse({ error: "invalid_form_data" }, 400);
  }

  const requestId = String(form.get("requestId") ?? "");
  if (!UUID_RE.test(requestId)) {
    return jsonResponse({ error: "invalid_request_id" }, 400);
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return jsonResponse({ error: "missing_file" }, 400);
  }
  if (file.size <= 0) {
    return jsonResponse({ error: "empty_file" }, 400);
  }
  if (file.size > MAX_FILE_BYTES) {
    return jsonResponse({ error: "file_too_large" }, 400);
  }

  const mime = file.type || "application/octet-stream";
  const safeName = sanitizeFilename(file.name || "upload");
  if (!ALLOWED_MIME.has(mime) && !ALLOWED_EXT_RE.test(safeName)) {
    return jsonResponse({ error: "unsupported_file_type" }, 400);
  }

  const path = `appraisal-requests/${requestId}/${Date.now()}_${safeName}`;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: mime, upsert: false });
  if (upErr) {
    console.error("appraisal upload failed:", upErr);
    return jsonResponse({ error: "upload_failed", message: upErr.message }, 500);
  }

  return jsonResponse({
    path,
    name: file.name,
    mimeType: mime,
    size: file.size,
  });
});
