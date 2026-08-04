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

function normaliseHeader(v: string): string {
  return v.replace(/^\uFEFF/, "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

/**
 * Map target column names to CSV column indices using the header row.
 * Protects against shifted imports when the source file carries an extra
 * leading index column or reordered columns.
 */
function buildColumnMap(headerLine: string, aliases: Record<string, string[]>): Record<string, number> {
  const headers = parseCSVLine(headerLine).map(normaliseHeader);
  const map: Record<string, number> = {};
  for (const [target, names] of Object.entries(aliases)) {
    for (const name of names) {
      const idx = headers.indexOf(normaliseHeader(name));
      if (idx !== -1) { map[target] = idx; break; }
    }
  }
  return map;
}

const RENTAL_ALIASES: Record<string, string[]> = {
  date: ["date", "month", "period"],
  region: ["region", "reid_region"],
  location: ["location", "micro_location", "area"],
  type: ["type", "property_type"],
  mgmt: ["mgmt", "management", "mgmt_type"],
  beds: ["beds", "bedrooms"],
  count: ["count", "properties", "property_count"],
  occupancy: ["occupancy", "occupancy_pct", "occupancy_rate"],
  rate_usd: ["rate_usd", "rate", "adr", "adr_usd", "average_daily_rate"],
  monthly_usd: ["monthly_usd", "monthly", "monthly_revenue_usd"],
  total_usd: ["total_usd", "total", "total_revenue_usd"],
};

const PROPERTY_ALIASES: Record<string, string[]> = {
  uqid: ["uqid", "uq_id", "unique_id"],
  id: ["id", "listing_id", "ref"],
  region: ["region", "reid_region"],
  location: ["location", "micro_location", "area"],
  contract_type: ["contract_type", "contract", "tenure"],
  property_type: ["property_type", "type"],
  years: ["years", "lease_years", "term"],
  bedrooms: ["bedrooms", "beds"],
  bathrooms: ["bathrooms", "baths"],
  land_size_sqm: ["land_size_sqm", "land_size", "land_sqm"],
  build_size_sqm: ["build_size_sqm", "build_size", "building_size_sqm", "internal_sqm"],
  fsr: ["fsr"],
  price_idr: ["price_idr", "idr_price"],
  price_usd: ["price_usd", "usd_price", "price"],
  price_per_sqm_usd: ["price_per_sqm_usd", "price_per_sqm", "usd_per_sqm"],
  price_per_year_usd: ["price_per_year_usd", "price_per_year", "usd_per_year"],
  availability: ["availability", "status"],
  sold_date: ["sold_date", "sold"],
  scrape_date: ["scrape_date", "scraped", "captured"],
  days_listed: ["days_listed", "days_on_market", "dom"],
  off_plan: ["off_plan", "offplan"],
};


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

      const map = buildColumnMap(lines[0], PROPERTY_ALIASES);
      const at = (row: string[], key: string, fallback: number) => {
        const idx = map[key] ?? fallback;
        return row[idx] ?? "";
      };

      const rows = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i]);
        if (cols.length < 5) continue;
        rows.push({
          uqid: parseInt(at(cols, "uqid", 0)) || i,
          id: at(cols, "id", 1).trim() || null,
          region: at(cols, "region", 2).trim() || null,
          location: at(cols, "location", 3).trim() || null,
          contract_type: at(cols, "contract_type", 4).trim() || null,
          property_type: at(cols, "property_type", 5).trim() || null,
          years: toNum(at(cols, "years", 6)),
          bedrooms: toNum(at(cols, "bedrooms", 7)),
          bathrooms: toNum(at(cols, "bathrooms", 8)),
          land_size_sqm: toNum(at(cols, "land_size_sqm", 9)),
          build_size_sqm: toNum(at(cols, "build_size_sqm", 10)),
          fsr: at(cols, "fsr", 11).trim() || null,
          price_idr: toMoney(at(cols, "price_idr", 12)),
          price_usd: toMoney(at(cols, "price_usd", 13)),
          price_per_sqm_usd: toMoney(at(cols, "price_per_sqm_usd", 14)),
          price_per_year_usd: toMoney(at(cols, "price_per_year_usd", 15)),
          availability: at(cols, "availability", 16).trim() || null,
          sold_date: at(cols, "sold_date", 17).trim() || null,
          scrape_date: at(cols, "scrape_date", 18).trim() || null,
          days_listed: toNum(at(cols, "days_listed", 19)),
          off_plan: at(cols, "off_plan", 20).trim() || null,
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
