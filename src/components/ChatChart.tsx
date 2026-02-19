import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

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

export function parseChartBlock(json: string): ChartData | null {
  try {
    const parsed = JSON.parse(json);
    if (!parsed.data || !Array.isArray(parsed.data) || parsed.data.length === 0) return null;
    const type = ["bar", "line", "pie"].includes(parsed.type) ? parsed.type : "bar";
    const allKeys = Object.keys(parsed.data[0]);
    const xKey = parsed.xKey || allKeys[0];
    const dataKeys = parsed.dataKeys || allKeys.filter((k) => k !== xKey && typeof parsed.data[0][k] === "number");
    if (dataKeys.length === 0) return null;
    return { type, title: parsed.title, data: parsed.data, xKey, dataKeys };
  } catch {
    return null;
  }
}

export default function ChatChart({ chart }: { chart: ChartData }) {
  const { type, title, data, xKey = "name", dataKeys = [] } = chart;

  return (
    <div className="my-4 rounded-xl border border-border bg-card p-4">
      {title && <p className="text-sm font-medium mb-3 text-foreground">{title}</p>}
      <ResponsiveContainer width="100%" height={280}>
        {type === "pie" ? (
          <PieChart>
            <Pie
              data={data}
              dataKey={dataKeys[0]}
              nameKey={xKey}
              cx="50%"
              cy="50%"
              outerRadius={100}
              label={({ name, value }) => `${name}: ${formatValue(value)}`}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(v: number) => formatValue(v)} />
            <Legend />
          </PieChart>
        ) : type === "line" ? (
          <LineChart data={data}>
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
          <BarChart data={data}>
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
}
