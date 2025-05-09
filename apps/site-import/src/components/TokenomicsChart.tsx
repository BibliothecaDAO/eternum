import { Pie, PieChart } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const tokenomicsData = [
  { allocation: "Staking Rewards", value: 40, fill: "oklch(0.43 0.04 41.99)" },
  { allocation: "Game Rewards", value: 35, fill: "oklch(0.92 0.07 74.37)" },
  { allocation: "Development", value: 15, fill: "oklch(0.93 0 0)" },
  { allocation: "Community", value: 10, fill: "oklch(0.94 0.05 75.50)" },
];

export function TokenomicsChart() {
  return (
    <Card className="backdrop-blur-md  sm:w-1/2 mx-auto">
      <CardHeader className="items-center pb-0">
        <CardTitle className="text-4xl">Token Distribution</CardTitle>
        <CardDescription className="text-2xl">
          Supply: 300,000,000 LORDS
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        <div className="mx-auto aspect-square max-h-[250px]">
          <PieChart width={250} height={250}>
            <Pie
              data={tokenomicsData}
              dataKey="value"
              nameKey="allocation"
              cx="50%"
              cy="50%"
              outerRadius={80}
              stroke="none"
            />
          </PieChart>
        </div>
      </CardContent>
      <div className="p-6 space-y-4 text-2xl">
        {tokenomicsData.map((item) => (
          <div
            key={item.allocation}
            className="flex justify-between items-center"
          >
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: item.fill }}
              />
              <span className=" text-muted-foreground">{item.allocation}</span>
            </div>
            <span className="font-bold">{item.value}%</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
