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

  it("rejects files larger than the per-file byte cap as csv_too_large for CSVs", () => {
    const tooBig = bigFile("portfolio.csv", ATTACHMENT_LIMITS.maxFileBytes + 1024);
    const { accepted, rejections } = validateSelection([tooBig], []);
    expect(accepted).toHaveLength(0);
    expect(rejections[0].code).toBe("csv_too_large");
  });

  it("rejects non-CSV files larger than the cap as file_too_large", () => {
    const tooBig = bigFile("big.txt", ATTACHMENT_LIMITS.maxFileBytes + 1024);
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
    const out = await parseAttachments([makeFile("a.txt", "hello world")]);
    expect(out).toEqual([{ name: "a.txt", content: "hello world" }]);
  });

  it("compacts a realistic ~70KB portfolio CSV instead of rejecting it", async () => {
    const headers = [
      "Property ID","Status","Property Type","Region","Neighbourhood",
      "Bedrooms","Bathrooms","Property Size","Land Size","Ownership Type",
      "Listed Price","Sold Price","Price per sqm","Date Listed","Date Sold","Days on Market",
      "Description","Features",
      "extra_1","extra_2","extra_3","extra_4","extra_5","extra_6","extra_7",
    ];
    const rows: string[] = [];
    for (let i = 0; i < 156; i++) {
      rows.push([
        `P-${i}`, "Sold", "Villa", "Canggu", "Berawa",
        "3", "3", "250", "300", "Leasehold",
        "500000", "480000", "1920", "2024-01-01", "2024-03-15", "73",
        "A long verbose description ".repeat(8),
        "Pool, garden, parking, security, ocean view",
        "x","y","z","a","b","c","d",
      ].join(","));
    }
    const csv = [headers.join(","), ...rows].join("\n");
    const file = new File([csv], "Sales portfolio.csv", { type: "text/csv" });
    expect(file.size).toBeGreaterThan(50_000);
    const out = await parseAttachments([file]);
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("Sales portfolio.csv");
    expect(out[0].content).toContain("[CSV: Sales portfolio.csv]");
    expect(out[0].content).toContain("rows=156");
    expect(out[0].content).toContain("Property ID");
    // Verbose columns omitted by default
    expect(out[0].content).toContain("Columns omitted");
    expect(out[0].content).toContain("Description");
  });

  it("throws csv_parse_error on a CSV with no header fields", async () => {
    const file = new File([""], "broken.csv", { type: "text/csv" });
    await expect(parseAttachments([file])).rejects.toMatchObject({ code: "csv_parse_error" });
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
    expect(attachmentErrorMessage("csv_too_large", "x")).toContain("under 250KB");
    expect(attachmentErrorMessage("file_too_large", "x")).toContain("under 250KB");
    expect(attachmentErrorMessage("csv_parse_error", "x")).toContain("could not be parsed");
    expect(attachmentErrorMessage("too_many_files", "x")).toContain("up to 3 files");
    expect(attachmentErrorMessage("attachments_too_long", "x")).toContain("Attachment text too long");
    expect(attachmentErrorMessage("invalid_attachments", "x")).toContain("Attachment text too long");
  });

  it("falls back when the code is unknown", () => {
    expect(attachmentErrorMessage(undefined, "boom")).toBe("boom");
  });
});
