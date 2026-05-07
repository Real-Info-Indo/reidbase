// Shared validation for `fileContents` payloads sent by the chat clients.
// Keep limits in sync with the client-side checks in src/lib/fileAttachments.ts.

export const ATTACHMENT_LIMITS = {
  maxFiles: 3,
  // Per-file character cap. The client compacts CSVs before sending so the
  // prompt-side text usually stays well under this; we still need headroom for
  // a fully expanded ~250KB CSV that the client chose not to compact.
  maxPerFileChars: 300_000,
  // Hard cap on combined attachment text injected into the final prompt.
  maxCombinedChars: 150_000,
} as const;

export interface AttachmentFile {
  name: string;
  content: string;
}

export interface AttachmentValidationError {
  status: number;
  code: string;
  message: string;
}

export function validateFileContents(
  raw: unknown,
): { ok: true; files: AttachmentFile[] } | { ok: false; error: AttachmentValidationError } {
  if (raw === undefined || raw === null) return { ok: true, files: [] };
  if (!Array.isArray(raw)) {
    return {
      ok: false,
      error: { status: 400, code: "invalid_attachments", message: "fileContents must be an array." },
    };
  }
  if (raw.length > ATTACHMENT_LIMITS.maxFiles) {
    return {
      ok: false,
      error: {
        status: 400,
        code: "too_many_files",
        message: `You can attach up to ${ATTACHMENT_LIMITS.maxFiles} files per message.`,
      },
    };
  }
  let combined = 0;
  const files: AttachmentFile[] = [];
  for (const f of raw) {
    if (!f || typeof f !== "object") {
      return { ok: false, error: { status: 400, code: "invalid_attachment", message: "Each attachment must be an object." } };
    }
    const name = (f as any).name;
    const content = (f as any).content;
    if (typeof name !== "string" || typeof content !== "string") {
      return {
        ok: false,
        error: { status: 400, code: "invalid_attachment", message: "Attachment name and content must be strings." },
      };
    }
    if (content.length > ATTACHMENT_LIMITS.maxPerFileChars) {
      return {
        ok: false,
        error: {
          status: 413,
          code: "file_too_large",
          message: `Attachment "${name}" exceeds the per-file size limit.`,
        },
      };
    }
    combined += content.length;
    files.push({ name, content });
  }
  if (combined > ATTACHMENT_LIMITS.maxCombinedChars) {
    return {
      ok: false,
      error: {
        status: 413,
        code: "attachments_too_long",
        message: `Combined attachment text exceeds ${ATTACHMENT_LIMITS.maxCombinedChars} characters.`,
      },
    };
  }
  return { ok: true, files };
}

/** Build the `[USER ATTACHED FILES ...]` block to inject into the final RAG/explain prompt. */
export function buildAttachmentBlock(files: AttachmentFile[]): string {
  if (!files.length) return "";
  const body = files
    .map((f) => `--- Attached File: ${f.name} ---\n${f.content}\n--- End of ${f.name} ---`)
    .join("\n\n");
  return `\n\n[USER ATTACHED FILES - Use these alongside the database when answering]\n${body}`;
}
