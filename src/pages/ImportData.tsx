import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { AdminGate } from "@/components/AdminGate";
import { wixAuthHeader } from "@/lib/wixToken";

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { current += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { result.push(current); current = ""; }
      else { current += ch; }
    }
  }
  result.push(current);
  return result;
}

function toNum(v: string): number | null {
  if (!v || v.trim() === "") return null;
  const n = Number(v.replace(/,/g, "").replace(/%/g, ""));
  return isNaN(n) ? null : n;
}

function toCurrency(v: string): number | null {
  if (!v || v.trim() === "" || v.trim() === "$0.00") return null;
  const n = Number(v.replace(/[$,]/g, ""));
  return isNaN(n) ? null : n;
}

// Strip any currency prefix/symbol (Rp, $, IDR, USD, commas, spaces) before parsing.
function toMoney(v: string): number | null {
  if (!v || v.trim() === "") return null;
  const cleaned = v.replace(/[^0-9.\-]/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return null;
  const n = Number(cleaned);
  return isNaN(n) ? null : n;
}

function toPercent(v: string): number | null {
  if (!v || v.trim() === "") return null;
  const n = Number(v.replace(/%/g, ""));
  return isNaN(n) ? null : n;
}

async function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export default function ImportData() {
  const { authenticated, checking, error } = useAdminAuth();
  const [status, setStatus] = useState("");
  const [rentalStatus, setRentalStatus] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [isImportingRentals, setIsImportingRentals] = useState(false);
  const [propertyFile, setPropertyFile] = useState<File | null>(null);
  const [rentalFile, setRentalFile] = useState<File | null>(null);
  const propertyInputRef = useRef<HTMLInputElement>(null);
  const rentalInputRef = useRef<HTMLInputElement>(null);

  const handleImport = async (replace = false) => {
    if (!propertyFile) {
      toast.error("Choose a CSV file first");
      return;
    }
    if (replace && !confirm("This will DELETE all existing property rows, then import the selected CSV. Continue?")) return;
    setIsImporting(true);
    setStatus(`Reading ${propertyFile.name}...`);

    try {
      const text = await readFileText(propertyFile);
      const lines = text.split("\n").filter(l => l.trim());

      setStatus(`Parsing ${lines.length - 1} rows...`);

      const rows = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i]);
        if (cols.length < 5) continue;
        rows.push({
          uqid: parseInt(cols[0]) || i,
          id: cols[1] || null,
          region: cols[2] || null,
          location: cols[3] || null,
          contract_type: cols[4] || null,
          property_type: cols[5] || null,
          years: toNum(cols[6]),
          bedrooms: toNum(cols[7]),
          bathrooms: toNum(cols[8]),
          land_size_sqm: toNum(cols[9]),
          build_size_sqm: toNum(cols[10]),
          fsr: cols[11] || null,
          price_idr: toMoney(cols[12]),
          price_usd: toMoney(cols[13]),
          price_per_sqm_usd: toMoney(cols[14]),
          price_per_year_usd: toMoney(cols[15]),
          availability: cols[16] || null,
          sold_date: cols[17] || null,
          scrape_date: cols[18] || null,
          days_listed: toNum(cols[19]),
          off_plan: cols[20] || null,
        });
      }

      setStatus(`Uploading ${rows.length} rows in batches...`);
      const chunkSize = 2000;
      let totalInserted = 0;
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        const { data, error } = await supabase.functions.invoke("import-csv", {
          body: { rows: chunk, truncate: replace && i === 0 },
          headers: await wixAuthHeader(),
        });
        if (error) throw new Error(error.message);
        totalInserted += data.inserted;
        setStatus(`Uploaded ${totalInserted} / ${rows.length} rows...`);
      }

      setStatus(`Done. Imported ${totalInserted} rows.`);
      toast.success(`Successfully imported ${totalInserted} properties`);
    } catch (err: any) {
      console.error(err);
      setStatus(`Error: ${err.message}`);
      toast.error("Import failed: " + err.message);
    } finally {
      setIsImporting(false);
    }
  };

  const handleImportRentals = async (replace = false) => {
    if (!rentalFile) {
      toast.error("Choose a CSV file first");
      return;
    }
    if (replace && !confirm("This will DELETE all existing rental rows, then import the selected CSV. Continue?")) return;
    setIsImportingRentals(true);
    setRentalStatus(`Reading ${rentalFile.name}...`);

    try {
      const text = await readFileText(rentalFile);
      const lines = text.split("\n").filter(l => l.trim());

      setRentalStatus(`Parsing ${lines.length - 1} rows...`);

      const rows = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i]);
        if (cols.length < 11) continue;
        rows.push({
          date: cols[0]?.trim() || null,
          region: cols[1]?.trim() || null,
          location: cols[2]?.trim() || null,
          type: cols[3]?.trim() || null,
          mgmt: cols[4]?.trim() || null,
          beds: toNum(cols[5]),
          count: toNum(cols[6]),
          occupancy: toPercent(cols[7]),
          rate_usd: toCurrency(cols[8]),
          monthly_usd: toCurrency(cols[9]),
          total_usd: toCurrency(cols[10]),
        });
      }

      const deduped = new Map<string, typeof rows[0]>();
      for (const row of rows) {
        const key = `${row.date}|${row.region}|${row.location}|${row.type}|${row.mgmt}|${row.beds}`;
        deduped.set(key, row);
      }
      const uniqueRows = Array.from(deduped.values());

      setRentalStatus(`Uploading ${uniqueRows.length} unique rows (${rows.length - uniqueRows.length} duplicates removed)...`);
      const chunkSize = 2000;
      let totalInserted = 0;
      for (let i = 0; i < uniqueRows.length; i += chunkSize) {
        const chunk = uniqueRows.slice(i, i + chunkSize);
        const { data, error } = await supabase.functions.invoke("import-rentals", {
          body: { rows: chunk, truncate: replace && i === 0 },
          headers: await wixAuthHeader(),
        });
        if (error) throw new Error(error.message);
        totalInserted += data.inserted;
        setRentalStatus(`Uploaded ${totalInserted} / ${uniqueRows.length} rows...`);
      }

      setRentalStatus(`Done. Imported ${totalInserted} rows.`);
      toast.success(`Successfully imported ${totalInserted} rental records`);
    } catch (err: any) {
      console.error(err);
      setRentalStatus(`Error: ${err.message}`);
      toast.error("Rental import failed: " + err.message);
    } finally {
      setIsImportingRentals(false);
    }
  };

  if (!authenticated) {
    return <AdminGate checking={checking} error={error} />;
  }

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-background p-8 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Import Property Data</h1>
      <p className="text-muted-foreground font-extralight mb-4">
        Select a CSV file. Append upserts on uqid (existing rows updated, new rows added). Replace wipes the table first, then imports.
      </p>
      <div className="mb-4 space-y-2">
        <input
          ref={propertyInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => setPropertyFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded file:border-0 file:bg-primary file:text-primary-foreground hover:file:opacity-90"
        />
        {propertyFile && (
          <p className="text-xs text-muted-foreground">
            Selected: {propertyFile.name} ({(propertyFile.size / 1024).toFixed(1)} KB)
          </p>
        )}
      </div>
      <div className="flex gap-3 flex-wrap">
        <Button onClick={() => handleImport(false)} disabled={isImporting || !propertyFile} size="lg">
          {isImporting ? "Importing..." : "Append / Update"}
        </Button>
        <Button onClick={() => handleImport(true)} disabled={isImporting || !propertyFile} size="lg" variant="destructive">
          Replace All Data
        </Button>
      </div>
      {status && <p className="mt-4 text-sm font-mono">{status}</p>}

      <hr className="my-8 border-border" />

      <h1 className="text-2xl font-bold mb-4">Import Rental Data</h1>
      <p className="text-muted-foreground font-extralight mb-4">
        Select a CSV file. Append upserts on date+region+location+type+mgmt+beds. Replace wipes the table first, then imports.
      </p>
      <div className="mb-4 space-y-2">
        <input
          ref={rentalInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => setRentalFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded file:border-0 file:bg-primary file:text-primary-foreground hover:file:opacity-90"
        />
        {rentalFile && (
          <p className="text-xs text-muted-foreground">
            Selected: {rentalFile.name} ({(rentalFile.size / 1024).toFixed(1)} KB)
          </p>
        )}
      </div>
      <div className="flex gap-3 flex-wrap">
        <Button onClick={() => handleImportRentals(false)} disabled={isImportingRentals || !rentalFile} size="lg">
          {isImportingRentals ? "Importing..." : "Append / Update"}
        </Button>
        <Button onClick={() => handleImportRentals(true)} disabled={isImportingRentals || !rentalFile} size="lg" variant="destructive">
          Replace All Data
        </Button>
      </div>
      {rentalStatus && <p className="mt-4 text-sm font-mono">{rentalStatus}</p>}
    </div>
  );
}
