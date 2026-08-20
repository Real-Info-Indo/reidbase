import { DonutChart } from "@/components/dashboard/charts";

export default function PieTest() {
  const data = [
    { name: "Leasehold", value: 60 },
    { name: "Freehold", value: 40 },
  ];
  return (
    <div className="flex h-screen items-center justify-center bg-background p-8">
      <div className="h-80 w-80">
        <DonutChart
          data={data}
          colours={["#e8a838", "#224339"]}
          format={(v) => `${v}`}
        />
      </div>
    </div>
  );
}
