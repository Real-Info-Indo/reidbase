import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  const n = Number(v.replace(/,/g, "").replace(/%/g, "").replace(/\$/g, "").replace(/Rp/g, ""));
  return isNaN(n) ? null : n;
}

export default function ImportData() {
  const [status, setStatus] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [rentalStatus, setRentalStatus] = useState("");
  const [isImportingRentals, setIsImportingRentals] = useState(false);

  const handleImport = async () => {
    setIsImporting(true);
    setStatus("Loading CSV file...");
    try {
      const resp = await fetch("/data/2025_REID_Database_CSV.csv");
      const text = await resp.text();
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
          price_idr: toNum(cols[12]),
          price_usd: toNum(cols[13]),
          price_per_sqm_usd: toNum(cols[14]),
          price_per_year_usd: toNum(cols[15]),
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
          body: { rows: chunk },
        });
        if (error) throw new Error(error.message);
        totalInserted += data.inserted;
        setStatus(`Uploaded ${totalInserted} / ${rows.length} rows...`);
      }
      setStatus(`✅ Done! Imported ${totalInserted} rows.`);
      toast.success(`Successfully imported ${totalInserted} properties`);
    } catch (err: any) {
      console.error(err);
      setStatus(`❌ Error: ${err.message}`);
      toast.error("Import failed: " + err.message);
    } finally {
      setIsImporting(false);
    }
  };

  const handleRentalImport = async () => {
    setIsImportingRentals(true);
    setRentalStatus("Creating rentals table...");
    try {
      // Step 1: Create table
      const { data: createData, error: createError } = await supabase.functions.invoke("import-rentals", {
        body: { action: "create_table" },
      });
      if (createError) throw new Error(createError.message);
      setRentalStatus("Table created. Loading CSV...");

      // Step 2: Parse CSV
      const resp = await fetch("/data/2025_REID_Rental_Database_CSV.csv");
      const text = await resp.text();
      const lines = text.split("\n").filter(l => l.trim());
      setRentalStatus(`Parsing ${lines.length - 1} rental rows...`);

      const rows = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i]);
        if (cols.length < 10) continue;
        rows.push({
          date: cols[0] || null,
          region: cols[1] || null,
          location: cols[2] || null,
          type: cols[3] || null,
          mgmt: cols[4] || null,
          beds: toNum(cols[5]),
          count: toNum(cols[6]),
          occupancy: toNum(cols[7]),
          rate_idr: toNum(cols[8]),
          rate_usd: toNum(cols[9]),
          monthly_idr: toNum(cols[10]),
          monthly_usd: toNum(cols[11]),
          total_revenue: toNum(cols[12]),
        });
      }

      // Step 3: Upload in chunks
      setRentalStatus(`Uploading ${rows.length} rental rows...`);
      const chunkSize = 2000;
      let totalInserted = 0;
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        const { data, error } = await supabase.functions.invoke("import-rentals", {
          body: { action: "insert", rows: chunk },
        });
        if (error) throw new Error(error.message);
        totalInserted += data.inserted;
        setRentalStatus(`Uploaded ${totalInserted} / ${rows.length} rental rows...`);
      }

      setRentalStatus(`✅ Done! Imported ${totalInserted} rental rows.`);
      toast.success(`Successfully imported ${totalInserted} rental records`);
    } catch (err: any) {
      console.error(err);
      setRentalStatus(`❌ Error: ${err.message}`);
      toast.error("Rental import failed: " + err.message);
    } finally {
      setIsImportingRentals(false);
    }
  };

  return (
    <div className="p-8 max-w-xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-4">Import Property Data</h1>
        <p className="text-muted-foreground font-extralight mb-6">
          Import the REID property CSV data into the database.
        </p>
        <Button onClick={handleImport} disabled={isImporting} size="lg">
          {isImporting ? "Importing..." : "Start Property Import"}
        </Button>
        {status && <p className="mt-4 text-sm font-mono">{status}</p>}
      </div>

      <div className="border-t border-border pt-8">
        <h1 className="text-2xl font-bold mb-4">Import Rental Data</h1>
        <p className="text-muted-foreground font-extralight mb-6">
          Import the REID rental CSV data into the database. This will create the table and import all records.
        </p>
        <Button onClick={handleRentalImport} disabled={isImportingRentals} size="lg">
          {isImportingRentals ? "Importing..." : "Start Rental Import"}
        </Button>
        {rentalStatus && <p className="mt-4 text-sm font-mono">{rentalStatus}</p>}
      </div>
    </div>
  );
}
