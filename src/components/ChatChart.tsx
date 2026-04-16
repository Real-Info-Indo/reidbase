import { useRef, useCallback, useMemo, memo } from "react";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Download, Share2, Mail } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(210, 70%, 55%)",
  "hsl(150, 60%, 45%)",
  "hsl(45, 80%, 55%)",
  "hsl(0, 65%, 55%)",
  "hsl(270, 60%, 55%)",
  "hsl(180, 55%, 45%)",
  "hsl(330, 60%, 55%)",
];

export interface ChartData {
  type: "bar" | "line" | "pie";
  title?: string;
  data: Record<string, unknown>[];
  xKey?: string;
  dataKeys?: string[];
  stacked?: boolean;
}

function formatValue(value: number, key?: string): string {
  if (typeof value !== "number") return String(value ?? "");
  if (!key) return value.toLocaleString();
  const lower = key.toLowerCase();
  if (lower.includes("occupancy") || lower.includes("rate") || lower.includes("yield") || lower.includes("percent") || lower.includes("pct") || lower.includes("%")) {
    return `${value.toFixed(1)}%`;
  }
  if (lower.includes("price") || lower.includes("usd") || lower.includes("adr") || lower.includes("revenue") || lower.includes("value") || lower.includes("cost")) {
    return value >= 1000 ? `$${(value / 1000).toFixed(0)}k` : `$${value.toLocaleString()}`;
  }
  if (lower.includes("sqm") || lower.includes("size") || lower.includes("area")) {
    return `${value.toLocaleString()} sqm`;
  }
  return value.toLocaleString();
}

const chartCache = new Map<string, ChartData>();

export function parseChartBlock(json: string): ChartData | null {
  const cached = chartCache.get(json);
  if (cached) return cached;
  try {
    const parsed = JSON.parse(json);
    if (!parsed.data || !Array.isArray(parsed.data) || parsed.data.length === 0) return null;
    const type = ["bar", "line", "pie"].includes(parsed.type) ? parsed.type : "bar";
    const allKeys = Object.keys(parsed.data[0]);
    const xKey = parsed.xKey || allKeys[0];
    const dataKeys = parsed.dataKeys || allKeys.filter((k) => k !== xKey && typeof parsed.data[0][k] === "number");
    if (dataKeys.length === 0) return null;
    const result: ChartData = { type, title: parsed.title, data: parsed.data, xKey, dataKeys, stacked: parsed.stacked };
    chartCache.set(json, result);
    return result;
  } catch {
    return null;
  }
}

function getChartCanvas(chartRef: React.RefObject<HTMLDivElement>): Promise<HTMLCanvasElement | null> {
  return new Promise((resolve) => {
    if (!chartRef.current) return resolve(null);
    const svg = chartRef.current.querySelector("svg");
    if (!svg) return resolve(null);
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return resolve(null);
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width * 2;
      canvas.height = img.height * 2;
      ctx.scale(2, 2);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, img.width, img.height);
      ctx.drawImage(img, 0, 0);
      resolve(canvas);
    };
    img.onerror = () => resolve(null);
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  });
}

const ChatChart = memo(function ChatChart({ chart }: { chart: ChartData }) {
  const { type, title, data, xKey = "name", dataKeys = [], stacked } = chart;
  const chartRef = useRef<HTMLDivElement>(null);
  const needsAngle = data.length > 6;
  const primaryDataKey = dataKeys[0] || "";

  const handleDownload = useCallback(async () => {
    const canvas = await getChartCanvas(chartRef);
    if (!canvas) return;
    const a = document.createElement("a");
    a.download = `${title || "chart"}.png`;
    a.href = canvas.toDataURL("image/png");
    a.click();
  }, [title]);

  const shareViaWhatsApp = useCallback(async () => {
    const canvas = await getChartCanvas(chartRef);
    if (!canvas) return;
    try {
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
      if (!blob) throw new Error("Failed to create image");
      if (navigator.share && navigator.canShare) {
        const file = new File([blob], `${title || "chart"}.png`, { type: "image/png" });
        const shareData = { files: [file], title: title || "Chart", text: title || "REID Base chart" };
        if (navigator.canShare(shareData)) {
          await navigator.share(shareData);
          return;
        }
      }
      const text = encodeURIComponent(title || "REID Base Market Intelligence chart");
      window.open(`https://wa.me/?text=${text}`, "_blank");
    } catch (e: unknown) {
      if (e instanceof Error && e.name === "AbortError") return;
      const text = encodeURIComponent(title || "REID Base Market Intelligence chart");
      window.open(`https://wa.me/?text=${text}`, "_blank");
    }
  }, [title]);

  const shareViaEmail = useCallback(async () => {
    const subject = encodeURIComponent("REID Base Market Intelligence");
    const body = encodeURIComponent(title ? `Chart: ${title}` : "REID Base chart");
    window.open(`mailto:?subject=${subject}&body=${body}`, "_self");
  }, [title]);

  const stableData = useMemo(() => data, [JSON.stringify(data)]);

  return (
    <div ref={chartRef} className="my-4 rounded-xl border border-border bg-card p-4 relative">
      <div className="absolute top-3 right-3 flex gap-1 z-10">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="p-1.5 rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-accent transition-colors"
              title="Share chart"
            >
              <Share2 className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[160px]">
            <DropdownMenuItem onClick={shareViaWhatsApp}>
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-[#25D366] mr-2 shrink-0" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Share via WhatsApp
            </DropdownMenuItem>
            <DropdownMenuItem onClick={shareViaEmail}>
              <Mail className="h-4 w-4 mr-2 shrink-0" />
              Share via email
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <button
          onClick={handleDownload}
          className="p-1.5 rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-accent transition-colors"
          title="Download chart"
        >
          <Download className="h-4 w-4" />
        </button>
      </div>
      {title && <p className="text-sm font-medium mb-3 text-foreground">{title}</p>}
      <ResponsiveContainer width="100%" height={280}>
        {type === "pie" ? (
          <PieChart>
            <Pie
              data={stableData}
              dataKey={dataKeys[0]}
              nameKey={xKey}
              cx="50%"
              cy="50%"
              outerRadius={100}
              label={({ name, value }) => `${name}: ${formatValue(value, primaryDataKey)}`}
            >
              {stableData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(v: number, name: string) => formatValue(v, name)} />
            <Legend />
          </PieChart>
        ) : type === "line" ? (
          <LineChart data={stableData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey={xKey}
              tick={{ fontSize: 11 }}
              stroke="hsl(var(--muted-foreground))"
              angle={needsAngle ? -35 : 0}
              textAnchor={needsAngle ? "end" : "middle"}
              height={needsAngle ? 50 : 30}
            />
            <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => formatValue(v, primaryDataKey)} />
            <Tooltip formatter={(v: number, name: string) => formatValue(v, name)} />
            {dataKeys.length > 1 && <Legend />}
            {dataKeys.map((key, i) => (
              <Line key={key} type="monotone" dataKey={key} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
            ))}
          </LineChart>
        ) : (
          <BarChart data={stableData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey={xKey}
              tick={{ fontSize: 11 }}
              stroke="hsl(var(--muted-foreground))"
              angle={needsAngle ? -35 : 0}
              textAnchor={needsAngle ? "end" : "middle"}
              height={needsAngle ? 50 : 30}
            />
            <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => formatValue(v, primaryDataKey)} />
            <Tooltip formatter={(v: number, name: string) => formatValue(v, name)} />
            {dataKeys.length > 1 && <Legend />}
            {dataKeys.map((key, i) => (
              <Bar key={key} dataKey={key} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} {...(stacked ? { stackId: "a" } : {})} />
            ))}
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
});

export default ChatChart;
