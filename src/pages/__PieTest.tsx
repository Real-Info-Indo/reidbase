import { DonutChart } from "@/components/dashboard/charts";
import { DashboardCard } from "@/components/dashboard/primitives";

const sample = [
  { name: "Leasehold", value: 63 },
  { name: "Freehold", value: 37 },
];

export default function PieTest() {
  return (
    <div className="min-h-screen bg-[#F8F4EC] p-8">
      <div className="mx-auto max-w-md">
        <DashboardCard title="Ownership type" subtitle="Share of listings by tenure">
          <DonutChart data={sample} colours={["#fdcb7f", "#ffe3bb"]} format={(v) => `${v} listings`} />
        </DashboardCard>
      </div>
    </div>
  );
}
