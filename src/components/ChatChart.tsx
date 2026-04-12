import { useRef, useCallback, useMemo, memo } from "react";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Download, Share2, Mail } from "lucide-react";
import { toast } from "sonner";
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
}

function formatValue(val: unknown): string {
  if (typeof val !== "number") return String(val ?? "");
  if (Math.abs(val) >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (Math.abs(val) >= 1_000) return `$${(val / 1_000).toFixed(0)}k`;
  return val.toLocaleString();
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
    const result: ChartData = { type, title: parsed.title, data: parsed.data, xKey, dataKeys };
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
  const { type, title, data, xKey = "name", dataKeys = [] } = chart;
  const chartRef = useRef<HTMLDivElement>(null);

  const handleDownload = useCallback(async () => {
    const canvas = await getChartCanvas(chartRef);
    if (!canvas) return;
    const a = document.createElement("a");
    a.download = `${title || "chart"}.png`;
    a.href = canvas.toDataURL("image/png");
    a.click();
  }, [title]);

  const handleShare = useCallback(async () => {
    const canvas = await getChartCanvas(chartRef);
    if (!canvas) return;
    try {
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
      if (!blob) throw new Error("Failed to create image");
      if (navigator.share && navigator.canShare) {
        const file = new File([blob], `${title || "chart"}.png`, { type: "image/png" });
        const shareData = { files: [file], title: title || "Chart" };
        if (navigator.canShare(shareData)) {
          await navigator.share(shareData);
          return;
        }
      }
      // Fallback: copy image to clipboard
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      toast.success("Chart copied to clipboard");
    } catch (e: unknown) {
      if (e instanceof Error && e.name === "AbortError") return;
      toast.error("Sharing not supported. Try downloading instead.");
    }
  }, [title]);

  const stableData = useMemo(() => data, [JSON.stringify(data)]);

  return (
    <div ref={chartRef} className="my-4 rounded-xl border border-border bg-card p-4 relative">
      <div className="absolute top-3 right-3 flex gap-1 z-10">
        <button
          onClick={handleShare}
          className="p-1.5 rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-accent transition-colors"
          title="Share chart"
        >
          <Share2 className="h-4 w-4" />
        </button>
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
              label={({ name, value }) => `${name}: ${formatValue(value)}`}
            >
              {stableData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(v: number) => formatValue(v)} />
            <Legend />
          </PieChart>
        ) : type === "line" ? (
          <LineChart data={stableData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey={xKey} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => formatValue(v)} />
            <Tooltip formatter={(v: number) => formatValue(v)} />
            {dataKeys.length > 1 && <Legend />}
            {dataKeys.map((key, i) => (
              <Line key={key} type="monotone" dataKey={key} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
            ))}
          </LineChart>
        ) : (
          <BarChart data={stableData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey={xKey} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => formatValue(v)} />
            <Tooltip formatter={(v: number) => formatValue(v)} />
            {dataKeys.length > 1 && <Legend />}
            {dataKeys.map((key, i) => (
              <Bar key={key} dataKey={key} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
            ))}
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
});

export default ChatChart;