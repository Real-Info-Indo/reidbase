// Client-side file attachment helpers. Keep limits in sync with
// supabase/functions/_shared/file-attachments.ts.

import Papa from "papaparse";

export const ATTACHMENT_LIMITS = {
  maxFiles: 3,
  // Per-file raw byte cap. CSV portfolios can be ~250KB; other text formats
  // share the same ceiling for simplicity.
  maxFileBytes: 250 * 1024,
  // Total extracted/compacted text injected into the prompt across all files.
  maxCombinedChars: 150_000,
  // Reasonable upper bound on rows for a portfolio CSV.
  maxCsvRows: 1000,
};

// Phase 1: only accept formats we can safely read with file.text() / parse as CSV.
// Binary formats (.pdf, .docx, .xlsx) require a real text-extraction step that we
// have not built yet, so they are intentionally rejected up front.
export const ACCEPTED_EXTENSIONS = [".txt", ".csv", ".json", ".md"] as const;
export const ACCEPT_ATTRIBUTE = ACCEPTED_EXTENSIONS.join(",");

// Verbose free-text columns that we drop from CSV compaction by default.
const VERBOSE_CSV_COLUMNS = new Set(
  ["description", "features", "amenities", "notes", "remarks", "comments", "long description"],
);

// Portfolio columns we always try to preserve when present.
const PRIORITY_CSV_COLUMNS = [
  "Property ID", "Status", "Property Type", "Region", "Neighbourhood", "Neighborhood",
  "Bedrooms", "Bathrooms", "Property Size", "Land Size", "Ownership Type",
  "Listed Price", "Sold Price", "Price per sqm", "Date Listed", "Date Sold", "Days on Market",
];

export type ParsedAttachment = { name: string; content: string };

export interface AttachmentRejection {
  code:
    | "unsupported_type"
    | "file_too_large"
    | "csv_too_large"
    | "csv_parse_error"
    | "csv_too_many_rows"
    | "too_many_files"
    | "attachments_too_long";
  message: string;
}

function getExtension(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx === -1 ? "" : name.slice(idx).toLowerCase();
}

export function isAcceptedFile(file: File): boolean {
  return (ACCEPTED_EXTENSIONS as readonly string[]).includes(getExtension(file.name));
}

/**
 * Validate a freshly selected list of File objects without reading them.
 * Returns the accepted files plus a list of rejections suitable for toasts.
 */
export function validateSelection(
  newFiles: File[],
  existing: File[],
): { accepted: File[]; rejections: AttachmentRejection[] } {
  const rejections: AttachmentRejection[] = [];
  const accepted: File[] = [];
  let total = existing.length;
  for (const f of newFiles) {
    const ext = getExtension(f.name);
    if (!isAcceptedFile(f)) {
      rejections.push({
        code: "unsupported_type",
        message: `"${f.name}" is not a supported file type. Allowed: ${ACCEPTED_EXTENSIONS.join(", ")}.`,
      });
      continue;
    }
    if (f.size > ATTACHMENT_LIMITS.maxFileBytes) {
      rejections.push({
        code: ext === ".csv" ? "csv_too_large" : "file_too_large",
        message: ext === ".csv"
          ? `This CSV is too large to analyse in chat. Please reduce it to under 250KB.`
          : `"${f.name}" is larger than 250KB.`,
      });
      continue;
    }
    if (total >= ATTACHMENT_LIMITS.maxFiles) {
      rejections.push({
        code: "too_many_files",
        message: `Too many attached files. Please attach up to ${ATTACHMENT_LIMITS.maxFiles} files.`,
      });
      continue;
    }
    accepted.push(f);
    total += 1;
  }
  return { accepted, rejections };
}

async function readFileText(file: File): Promise<string> {
  if (typeof (file as any).text === "function") return await (file as any).text();
  if (typeof (file as any).arrayBuffer === "function") {
    return new TextDecoder().decode(await (file as any).arrayBuffer());
  }
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error || new Error("FileReader failed"));
    reader.readAsText(file);
  });
}

function asAttachmentError(code: AttachmentRejection["code"], message: string): Error & { code: string } {
  const err = new Error(message) as Error & { code: string };
  err.code = code;
  return err;
}

function isNumericLike(v: unknown): boolean {
  if (typeof v === "number") return Number.isFinite(v);
  if (typeof v !== "string") return false;
  const s = v.replace(/[$,\s]/g, "");
  if (s === "") return false;
  const n = Number(s);
  return Number.isFinite(n);
}

function toNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const n = Number(v.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Compact a parsed CSV into a prompt-safe text block. */
export function compactCsv(name: string, headers: string[], rows: Record<string, unknown>[]): string {
  const keptHeaders = headers.filter((h) => !VERBOSE_CSV_COLUMNS.has(h.trim().toLowerCase()));
  const droppedHeaders = headers.filter((h) => VERBOSE_CSV_COLUMNS.has(h.trim().toLowerCase()));

  // Order: priority columns first (those that exist), then the rest.
  const priorityPresent = PRIORITY_CSV_COLUMNS.filter((p) =>
    keptHeaders.some((h) => h.trim().toLowerCase() === p.toLowerCase()),
  ).map((p) => keptHeaders.find((h) => h.trim().toLowerCase() === p.toLowerCase())!);
  const ordered = [
    ...priorityPresent,
    ...keptHeaders.filter((h) => !priorityPresent.includes(h)),
  ];

  // Numeric summaries
  const summaries: string[] = [];
  for (const col of ordered) {
    const vals = rows.map((r) => r[col]).filter((v) => v !== undefined && v !== null && v !== "");
    if (vals.length && vals.every(isNumericLike)) {
      const nums = vals.map(toNumber).filter((n): n is number => n !== null);
      if (nums.length) {
        const min = Math.min(...nums);
        const max = Math.max(...nums);
        const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
        summaries.push(
          `- ${col}: count=${nums.length}, min=${min}, max=${max}, avg=${avg.toFixed(2)}, median=${median(nums)}`,
        );
      }
    }
  }

  const header = `[CSV: ${name}] rows=${rows.length}, columns=${headers.length}`;
  const colsLine = `Columns kept: ${ordered.join(" | ")}`;
  const droppedLine = droppedHeaders.length
    ? `Columns omitted (verbose, ask if needed): ${droppedHeaders.join(", ")}`
    : "";
  const summaryBlock = summaries.length
    ? `Numeric summaries:\n${summaries.join("\n")}`
    : "";

  // Emit rows as TSV-like compact lines using ordered columns.
  const rowLines: string[] = [];
  rowLines.push(ordered.join("\t"));
  for (const r of rows) {
    rowLines.push(ordered.map((c) => {
      const v = r[c];
      if (v === undefined || v === null) return "";
      return String(v).replace(/[\t\r\n]+/g, " ").slice(0, 200);
    }).join("\t"));
  }

  const parts = [header, colsLine, droppedLine, summaryBlock, "Data:", rowLines.join("\n")]
    .filter(Boolean)
    .join("\n");
  return parts;
}

async function parseCsvFile(file: File): Promise<string> {
  const text = await readFileText(file);
  const result = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });
  // Treat structural errors as parse failure. Field-level "TooFewFields" warnings
  // are tolerated as long as we got rows + headers.
  const fatal = result.errors.find((e) => e.type === "Delimiter" || e.type === "Quotes");
  if (fatal || !result.meta.fields || result.meta.fields.length === 0) {
    throw asAttachmentError("csv_parse_error", "This CSV could not be parsed. Please check the file formatting.");
  }
  if (result.data.length > ATTACHMENT_LIMITS.maxCsvRows) {
    throw asAttachmentError(
      "csv_too_many_rows",
      `This CSV has ${result.data.length} rows. Please reduce it to under ${ATTACHMENT_LIMITS.maxCsvRows} rows.`,
    );
  }
  return compactCsv(file.name, result.meta.fields, result.data);
}

export async function parseAttachments(files: File[]): Promise<ParsedAttachment[]> {
  const parsed: ParsedAttachment[] = [];
  let total = 0;
  for (const file of files) {
    const ext = getExtension(file.name);
    let content: string;
    if (ext === ".csv") {
      content = await parseCsvFile(file);
    } else {
      content = await readFileText(file);
    }
    total += content.length;
    if (total > ATTACHMENT_LIMITS.maxCombinedChars) {
      throw asAttachmentError(
        "attachments_too_long",
        `Combined attachment text exceeds ${ATTACHMENT_LIMITS.maxCombinedChars} characters.`,
      );
    }
    parsed.push({ name: file.name, content });
  }
  return parsed;
}

/** Map an Edge Function error code to a user-facing toast message. */
export function attachmentErrorMessage(code: string | undefined, fallback: string): string {
  switch (code) {
    case "unsupported_type":
      return "Unsupported file type. Allowed: .txt, .csv, .json, .md.";
    case "csv_too_large":
      return "This CSV is too large to analyse in chat. Please reduce it to under 250KB.";
    case "file_too_large":
      return "File too large. Each attachment must be under 250KB.";
    case "csv_parse_error":
      return "This CSV could not be parsed. Please check the file formatting.";
    case "csv_too_many_rows":
      return "This CSV has too many rows. Please reduce it to under 1,000 rows.";
    case "too_many_files":
      return "Too many attached files. Please attach up to 3 files.";
    case "attachments_too_long":
    case "invalid_attachments":
    case "invalid_attachment":
      return "Attachment text too long or malformed. Please trim or remove files.";
    default:
      return fallback;
  }
}
