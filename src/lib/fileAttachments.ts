// Client-side file attachment helpers. Keep limits in sync with
// supabase/functions/_shared/file-attachments.ts.

export const ATTACHMENT_LIMITS = {
  maxFiles: 3,
  maxFileBytes: 1024 * 1024,     // 1MB per file
  maxCombinedChars: 40_000,      // total extracted-text budget
};

// Phase 1: only accept formats we can safely read with file.text(). Binary
// formats (.pdf, .docx, .xlsx) require a real text-extraction step that we
// have not built yet, so they are intentionally rejected up front.
export const ACCEPTED_EXTENSIONS = [".txt", ".csv", ".json", ".md"] as const;
export const ACCEPT_ATTRIBUTE = ACCEPTED_EXTENSIONS.join(",");

export type ParsedAttachment = { name: string; content: string };

export interface AttachmentRejection {
  code: "unsupported_type" | "file_too_large" | "too_many_files" | "attachments_too_long";
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
    if (!isAcceptedFile(f)) {
      rejections.push({
        code: "unsupported_type",
        message: `"${f.name}" is not a supported file type. Allowed: ${ACCEPTED_EXTENSIONS.join(", ")}.`,
      });
      continue;
    }
    if (f.size > ATTACHMENT_LIMITS.maxFileBytes) {
      rejections.push({
        code: "file_too_large",
        message: `"${f.name}" is larger than 1MB.`,
      });
      continue;
    }
    if (total >= ATTACHMENT_LIMITS.maxFiles) {
      rejections.push({
        code: "too_many_files",
        message: `You can attach up to ${ATTACHMENT_LIMITS.maxFiles} files per message.`,
      });
      continue;
    }
    accepted.push(f);
    total += 1;
  }
  return { accepted, rejections };
}

/**
 * Read accepted files as plain text. Caller must have already filtered the
 * list with validateSelection. Throws an AttachmentRejection-shaped error
 * if combined text exceeds the global cap.
 */
export async function parseAttachments(files: File[]): Promise<ParsedAttachment[]> {
  const parsed: ParsedAttachment[] = [];
  let total = 0;
  for (const file of files) {
    const text = typeof (file as any).text === "function"
      ? await (file as any).text()
      : new TextDecoder().decode(await file.arrayBuffer());
    total += text.length;
    if (total > ATTACHMENT_LIMITS.maxCombinedChars) {
      const err: Error & { code?: string } = new Error(
        `Combined attachment text exceeds ${ATTACHMENT_LIMITS.maxCombinedChars} characters.`,
      );
      err.code = "attachments_too_long";
      throw err;
    }
    parsed.push({ name: file.name, content: text });
  }
  return parsed;
}

/** Map an Edge Function error code to a user-facing toast message. */
export function attachmentErrorMessage(code: string | undefined, fallback: string): string {
  switch (code) {
    case "unsupported_type":
      return "Unsupported file type. Allowed: .txt, .csv, .json, .md.";
    case "file_too_large":
      return "File too large. Each attachment must be under 1MB.";
    case "too_many_files":
      return "Too many files. Attach up to 3 per message.";
    case "attachments_too_long":
    case "invalid_attachments":
    case "invalid_attachment":
      return "Attachment text too long or malformed. Please trim or remove files.";
    default:
      return fallback;
  }
}
