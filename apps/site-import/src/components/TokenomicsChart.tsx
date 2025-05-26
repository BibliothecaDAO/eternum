import { Pie, PieChart, ResponsiveContainer, Cell, Tooltip } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface TokenomicsChartProps {
  treasuryPercentage?: number;
  marketPercentage?: number;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background/95 backdrop-blur-sm border rounded-lg p-3 shadow-lg">
        <p className="font-semibold">{payload[0].payload.allocation}</p>
        <p className="text-sm text-muted-foreground">{payload[0].value}%</p>
        <p className="text-xs mt-1">{payload[0].payload.description}</p>
      </div>
    );
  }
  return null;
};

export function TokenomicsChart({
  treasuryPercentage = 40,
  marketPercentage = 60,
}: TokenomicsChartProps) {
  const tokenomicsData = [
    {
      allocation: "DAO Treasury",
      value: treasuryPercentage,
      fill: "oklch(0.7 0.15 150)", // Green
      description: "Controlled by DAO for ecosystem development",
    },
    {
      allocation: "Market Liquid",
      value: marketPercentage,
      fill: "oklch(0.7 0.15 250)", // Blue
      description: "Freely traded on decentralized exchanges",
    },
  ];

  return (
    <Card className="backdrop-blur-md border-border/50">
      <CardHeader className="text-center pb-2">
        <CardTitle className="text-3xl">Total Supply</CardTitle>
        <CardDescription className="text-xl">
          300,000,000 $LORDS
        </CardDescription>
        <p className="text-sm text-muted-foreground mt-2">
          100% Liquid • No Locks • No Vesting
        </p>
      </CardHeader>
      <CardContent className="pb-6">
        <div className="">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={tokenomicsData}
                dataKey="value"
                nameKey="allocation"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                stroke="none"
              >
                {tokenomicsData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-6 space-y-4">
          {tokenomicsData.map((item) => (
            <div
              key={item.allocation}
              className="flex justify-between items-start"
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-4 h-4 rounded-full mt-0.5 flex-shrink-0"
                  style={{ backgroundColor: item.fill }}
                />
                <div className="space-y-1">
                  <p className="font-medium">{item.allocation}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              </div>
              <span className="font-bold text-lg ml-4">
                {item.value.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
