import { describe, it, expect } from "vitest";
import {
  ACCEPT_ATTRIBUTE,
  ACCEPTED_EXTENSIONS,
  ATTACHMENT_LIMITS,
  attachmentErrorMessage,
  isAcceptedFile,
  parseAttachments,
  validateSelection,
} from "@/lib/fileAttachments";

function makeFile(name: string, content = "hello", type = "text/plain"): File {
  return new File([content], name, { type });
}

function bigFile(name: string, size: number): File {
  // construct without putting `size+1` bytes in memory all at once
  const chunk = "x".repeat(1024);
  const parts: string[] = [];
  for (let i = 0; i < Math.ceil(size / 1024); i++) parts.push(chunk);
  return new File(parts, name, { type: "text/plain" });
}

describe("fileAttachments accept list", () => {
  it("only allows text-readable formats", () => {
    expect([...ACCEPTED_EXTENSIONS].sort()).toEqual([".csv", ".json", ".md", ".txt"]);
    expect(ACCEPT_ATTRIBUTE).toBe(".txt,.csv,.json,.md");
  });

  it("rejects binary document formats up front", () => {
    expect(isAcceptedFile(makeFile("report.pdf"))).toBe(false);
    expect(isAcceptedFile(makeFile("data.xlsx"))).toBe(false);
    expect(isAcceptedFile(makeFile("memo.docx"))).toBe(false);
  });

  it("accepts whitelisted text formats", () => {
    expect(isAcceptedFile(makeFile("notes.txt"))).toBe(true);
    expect(isAcceptedFile(makeFile("data.csv"))).toBe(true);
    expect(isAcceptedFile(makeFile("payload.json"))).toBe(true);
    expect(isAcceptedFile(makeFile("readme.md"))).toBe(true);
  });
});

describe("validateSelection", () => {
  it("allows up to 3 small text files (happy path)", () => {
    const files = [makeFile("a.csv"), makeFile("b.txt"), makeFile("c.json")];
    const { accepted, rejections } = validateSelection(files, []);
    expect(accepted).toHaveLength(3);
    expect(rejections).toHaveLength(0);
  });

  it("rejects PDF/DOCX/XLSX with unsupported_type", () => {
    const files = [makeFile("a.pdf"), makeFile("b.docx"), makeFile("c.xlsx")];
    const { accepted, rejections } = validateSelection(files, []);
    expect(accepted).toHaveLength(0);
    expect(rejections.every((r) => r.code === "unsupported_type")).toBe(true);
  });

  it("rejects files larger than 1MB", () => {
    const tooBig = bigFile("big.txt", ATTACHMENT_LIMITS.maxFileBytes + 10);
    const { accepted, rejections } = validateSelection([tooBig], []);
    expect(accepted).toHaveLength(0);
    expect(rejections[0].code).toBe("file_too_large");
  });

  it("rejects when more than 3 files would be attached", () => {
    const existing = [makeFile("a.txt"), makeFile("b.txt"), makeFile("c.txt")];
    const { accepted, rejections } = validateSelection([makeFile("d.txt")], existing);
    expect(accepted).toHaveLength(0);
    expect(rejections[0].code).toBe("too_many_files");
  });
});

describe("parseAttachments", () => {
  it("reads text content for the happy path", async () => {
    const out = await parseAttachments([makeFile("a.csv", "x,y\n1,2\n")]);
    expect(out).toEqual([{ name: "a.csv", content: "x,y\n1,2\n" }]);
  });

  it("throws attachments_too_long when combined text exceeds the cap", async () => {
    const huge = "x".repeat(ATTACHMENT_LIMITS.maxCombinedChars);
    const second = "y".repeat(100);
    await expect(
      parseAttachments([makeFile("a.txt", huge), makeFile("b.txt", second)]),
    ).rejects.toMatchObject({ code: "attachments_too_long" });
  });
});

describe("attachmentErrorMessage", () => {
  it("maps known codes to user-facing copy", () => {
    expect(attachmentErrorMessage("unsupported_type", "x")).toContain("Unsupported file type");
    expect(attachmentErrorMessage("file_too_large", "x")).toContain("File too large");
    expect(attachmentErrorMessage("too_many_files", "x")).toContain("Too many files");
    expect(attachmentErrorMessage("attachments_too_long", "x")).toContain("Attachment text too long");
    expect(attachmentErrorMessage("invalid_attachments", "x")).toContain("Attachment text too long");
  });

  it("falls back when the code is unknown", () => {
    expect(attachmentErrorMessage(undefined, "boom")).toBe("boom");
  });
});
