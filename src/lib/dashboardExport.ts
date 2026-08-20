/** Client-side export helpers for the native dashboard: CSV, PNG and PDF. */

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "dashboard"
  );
}

function triggerDownload(href: string, filename: string) {
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/** Convert an array of flat records into a CSV string with a UTF-8 BOM. */
export function toCsv(rows: Array<Record<string, unknown>> | Array<unknown>): string {
  if (!rows.length) return "";
  const columns = Array.from(
    rows.reduce<Set<string>>((set, row) => {
      Object.keys(row as Record<string, unknown>).forEach((key) => set.add(key));
      return set;
    }, new Set<string>()),
  );
  const escape = (value: unknown) => {
    if (value == null) return "";
    const text = String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = [columns.join(",")];
  rows.forEach((row) => lines.push(columns.map((c) => escape((row as Record<string, unknown>)[c])).join(",")));
  return `\uFEFF${lines.join("\n")}`;
}

export function downloadChartCsv(
  rows: Array<Record<string, unknown>> | Array<unknown> | null | undefined,
  name: string,
): boolean {
  if (!rows || rows.length === 0) return false;
  const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  triggerDownload(url, `reid-${slugify(name)}.csv`);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

async function captureCanvas(element: HTMLElement) {
  const { default: html2canvas } = await import("html2canvas");
  const background = getComputedStyle(document.body).backgroundColor || "#F8F4EC";
  return html2canvas(element, {
    scale: 2,
    backgroundColor: background,
    useCORS: true,
    logging: false,
    ignoreElements: (el) => el.getAttribute?.("data-export-ignore") === "true",
  });
}

export async function downloadElementPng(element: HTMLElement, name: string) {
  const canvas = await captureCanvas(element);
  triggerDownload(canvas.toDataURL("image/png"), `reid-${slugify(name)}.png`);
}

/** Render an element to a single landscape A4 page, scaled to fit. */
export async function downloadElementPdf(element: HTMLElement, name: string) {
  const canvas = await captureCanvas(element);
  const { default: jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 18;
  const scale = Math.min(
    (pageWidth - margin * 2) / canvas.width,
    (pageHeight - margin * 2) / canvas.height,
  );
  const width = canvas.width * scale;
  const height = canvas.height * scale;
  pdf.addImage(
    canvas.toDataURL("image/png"),
    "PNG",
    (pageWidth - width) / 2,
    (pageHeight - height) / 2,
    width,
    height,
  );
  pdf.save(`reid-${slugify(name)}.pdf`);
}
