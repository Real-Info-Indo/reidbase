// cleanup-appraisal-uploads
//
// Removes orphaned files from the private `appraisals` bucket.
//
// Orphan definition:
//   - Object path begins with `appraisal-requests/{requestId}/`
//   - No row in `appraisal_requests.files` references that storage path
//   - Object is older than GRACE_PERIOD_MS (24h) so we don't race with
//     in-progress submissions that uploaded files but haven't yet inserted
//     the appraisal row.
//
// Access control:
//   - Internal-only. Caller must present `x-cleanup-secret` matching the
//     `APPRAISAL_CLEANUP_SECRET` environment variable, OR call with the
//     project's service-role key as the Authorization bearer (used by
//     pg_cron / scheduled jobs).
//   - Returns 401 otherwise. Never expose this function publicly.
//
// Scheduling:
//   See README at the bottom of this file or supabase/functions/cleanup-appraisal-uploads/README.md

import { verifyWixToken } from "../_shared/wix-auth.ts";
import { isAdmin } from "../_shared/admin.ts";
import { getServiceClient } from "../_shared/entitlements.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cleanup-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUCKET = "appraisals";
const PREFIX = "appraisal-requests";
const GRACE_PERIOD_MS = 24 * 60 * 60 * 1000; // 24 hours
const PAGE_SIZE = 1000;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function authorise(req: Request): Promise<{ ok: true } | { ok: false; status: number; body: unknown }> {
  // 1. Internal shared secret (preferred for pg_cron and manual ops).
  const expected = Deno.env.get("APPRAISAL_CLEANUP_SECRET");
  const provided = req.headers.get("x-cleanup-secret");
  if (expected && provided && provided === expected) {
    return { ok: true };
  }

  // 2. Service-role bearer (used when invoked from pg_net with the
  //    service role key, or by other privileged Supabase tooling).
  const auth = req.headers.get("Authorization") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (serviceKey && auth === `Bearer ${serviceKey}`) {
    return { ok: true };
  }

  // 3. Admin Wix user (for ad-hoc admin invocation).
  try {
    const identity = await verifyWixToken(auth);
    if (await isAdmin(identity.wixUserId)) return { ok: true };
  } catch {
    // fall through to unauthorised
  }

  return { ok: false, status: 401, body: { error: "unauthorized" } };
}

interface AppraisalRow {
  id: string;
  files: Array<{ path?: string }> | null;
}

interface StorageObject {
  name: string;
  created_at?: string;
  updated_at?: string;
  // metadata?: Record<string, unknown>;
}

async function listAllRequestFolders(supabase: ReturnType<typeof getServiceClient>): Promise<string[]> {
  // List the per-request subfolders directly under `appraisal-requests/`.
  const folders: string[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(PREFIX, { limit: PAGE_SIZE, offset });
    if (error) throw new Error(`list_${PREFIX}_failed: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const entry of data as StorageObject[]) {
      // Folder entries have no created_at; files would, but we don't expect
      // files directly under PREFIX. Add anything that isn't obviously a file.
      if (entry?.name) folders.push(entry.name);
    }
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return folders;
}

async function listObjectsInFolder(
  supabase: ReturnType<typeof getServiceClient>,
  folder: string,
): Promise<{ path: string; createdAt: number }[]> {
  const out: { path: string; createdAt: number }[] = [];
  let offset = 0;
  const dir = `${PREFIX}/${folder}`;
  while (true) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(dir, { limit: PAGE_SIZE, offset });
    if (error) throw new Error(`list_${dir}_failed: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const entry of data as StorageObject[]) {
      if (!entry?.name) continue;
      const created = entry.created_at ?? entry.updated_at;
      const createdAt = created ? Date.parse(created) : Date.now();
      out.push({ path: `${dir}/${entry.name}`, createdAt });
    }
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await authorise(req);
  if (!auth.ok) return jsonResponse(auth.body, auth.status);

  const startedAt = Date.now();
  const supabase = getServiceClient();
  const cutoff = startedAt - GRACE_PERIOD_MS;

  try {
    // Build a set of all referenced storage paths.
    const referenced = new Set<string>();
    const { data: rows, error: rowsErr } = await supabase
      .from("appraisal_requests")
      .select("id, files");
    if (rowsErr) throw new Error(`db_read_failed: ${rowsErr.message}`);
    for (const r of (rows ?? []) as AppraisalRow[]) {
      if (Array.isArray(r.files)) {
        for (const f of r.files) {
          if (f && typeof f.path === "string") referenced.add(f.path);
        }
      }
    }

    const folders = await listAllRequestFolders(supabase);
    let scanned = 0;
    let deleted = 0;
    let skippedYoung = 0;
    let skippedReferenced = 0;
    const toDelete: string[] = [];

    for (const folder of folders) {
      const objects = await listObjectsInFolder(supabase, folder);
      for (const obj of objects) {
        scanned++;
        if (referenced.has(obj.path)) {
          skippedReferenced++;
          continue;
        }
        if (obj.createdAt > cutoff) {
          skippedYoung++;
          continue;
        }
        toDelete.push(obj.path);
      }
    }

    // Delete in batches of 100.
    const errors: string[] = [];
    for (let i = 0; i < toDelete.length; i += 100) {
      const batch = toDelete.slice(i, i + 100);
      const { error: delErr } = await supabase.storage.from(BUCKET).remove(batch);
      if (delErr) {
        errors.push(delErr.message);
      } else {
        deleted += batch.length;
      }
    }

    const result = {
      ok: true,
      scanned,
      deleted,
      skippedReferenced,
      skippedYoung,
      gracePeriodHours: GRACE_PERIOD_MS / 3_600_000,
      durationMs: Date.now() - startedAt,
      errors: errors.length ? errors : undefined,
    };
    console.log("cleanup-appraisal-uploads:", JSON.stringify(result));
    return jsonResponse(result);
  } catch (err) {
    console.error("cleanup-appraisal-uploads error:", err);
    return jsonResponse(
      { error: "internal_error", message: (err as Error).message },
      500,
    );
  }
});
