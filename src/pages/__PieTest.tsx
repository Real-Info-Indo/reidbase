import { DonutChart } from "@/components/dashboard/charts";
import { DashboardCard } from "@/components/dashboard/primitives";

export default function PieTest() {
  const ownership = [
    { name: "Freehold", value: 420 },
    { name: "Leasehold", value: 580 },
  ];

  const mgmtSplit = [
    { name: "Professional", value: 350 },
    { name: "Individual", value: 450 },
    { name: "Unknown", value: 200 },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 p-6 lg:grid-cols-3">
      <DashboardCard title="Ownership type" subtitle="Two slices">
        <DonutChart data={ownership} colours={["#fdcb7f", "#ffe3bb"]} format={(v) => String(v)} />
      </DashboardCard>
      <DashboardCard title="Management type" subtitle="Three slices">
        <DonutChart data={mgmtSplit} colours={["#fdcb7f", "#ffe3bb", "#eb9a64"]} format={(v) => String(v)} />
      </DashboardCard>
      <DashboardCard title="Small slices" subtitle="Several thin slices">
        <DonutChart
          data={[
            { name: "A", value: 10 },
            { name: "B", value: 15 },
            { name: "C", value: 25 },
            { name: "D", value: 50 },
          ]}
          colours={["#fdcb7f", "#ffe3bb", "#eb9a64", "#182541"]}
          format={(v) => String(v)}
        />
      </DashboardCard>
    </div>
  );
}
