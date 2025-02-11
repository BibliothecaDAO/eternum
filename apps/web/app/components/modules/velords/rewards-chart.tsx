import type { ChartConfig } from "@/components/ui/chart";
import LordsIcon from "@/components/icons/lords.svg?react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, Line, XAxis, YAxis } from "recharts";

const sourceColors = {
  "Loot Survivor Fees": "hsl(36 88.9% 85.9%)",
  "veLords Early Exit Fees": "hsl(240 88.9% 85.9%)",
  Crypts: "hsl(120 88.9% 85.9%)",
  // Add more sources and colors as needed
} as const;

const chartConfig = {
  total_amount: {
    label: "Lords",
    color: "hsl(36 88.9% 85.9%)",
    icon: LordsIcon,
  },
  apy: {
    label: "APY %",
    color: "hsl(338.33 100% 78.82%)",
  },
} satisfies ChartConfig;

export function VeLordsRewardsChart({
  data,
  totalSupply,
}: {
  data?: {
    source: string;
    amount: string;
    transaction_hash: string;
    epoch: Date;
    epoch_total_amount: string;
    sender_epoch_total_amount: string;
  }[];
  totalSupply?: number;
}) {
  const parsedData = totalSupply
    ? data
        ?.reduce(
          (acc, item) => {
            const week = new Date(item.epoch).toISOString().split("T")[0];
            const existingWeek = acc.find((d) => d.week === week);

            if (existingWeek) {
              // Add to existing week
              existingWeek.amounts[item.source] =
                (existingWeek.amounts[item.source] || 0) +
                parseFloat(item.amount);
              existingWeek.total_amount += parseFloat(item.amount);
              // Recalculate APY based on total
              existingWeek.apy =
                ((existingWeek.total_amount * 52) / totalSupply) * 100;
            } else {
              // Create new week entry
              acc.push({
                week,
                amounts: {
                  [item.source]: parseFloat(item.amount),
                },
                total_amount: parseFloat(item.amount),
                apy: ((parseFloat(item.amount) * 52) / totalSupply) * 100,
              });
            }
            return acc;
          },
          [] as {
            week: string;
            amounts: Record<string, number>;
            total_amount: number;
            apy: number;
          }[],
        )
        .sort((a, b) => a.week.localeCompare(b.week))
    : [];
  console.log(parsedData);
  return (
    <Card>
      <CardHeader>Lords Rewards per Week</CardHeader>
      <CardContent>
        <ChartContainer
          config={chartConfig}
          className="max-h-[800px] min-h-[200px] w-full"
        >
          <BarChart data={parsedData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="week"
              label={{
                value: "Week Starting",
                position: "insideBottomLeft",
                offset: -5,
              }}
            />
            <YAxis
              yAxisId="amount"
              label={{
                value: "Total Lords Rewards",
                angle: -90,
                position: "insideLeft",
                offset: 18,
              }}
            />
            <YAxis
              yAxisId="apy"
              orientation="right"
              dataKey="apy"
              label={{
                value: "% APY (4 year lock)",
                angle: -90,
                position: "outside",
                offset: 25,
              }}
            />
            {/*<ChartTooltip content={<ChartTooltipContent />} />*/}
            <ChartLegend content={<ChartLegendContent />} />

            {/* Stacked bars for each source */}
            {Object.keys(sourceColors).map((source, index) => (
              <Bar
                key={source}
                dataKey={`amounts.${source}`}
                stackId="rewards"
                yAxisId="amount"
                fill={sourceColors[source as keyof typeof sourceColors]}
                stroke={sourceColors[source as keyof typeof sourceColors]}
                radius={
                  index === Object.keys(sourceColors).length - 1
                    ? [4, 4, 0, 0]
                    : [0, 0, 0, 0]
                }
              />
            ))}

            <Line
              dataKey="apy"
              type="monotone"
              yAxisId="apy"
              stroke="var(--color-apy)"
              fill="var(--color-apy)"
              activeDot={{ r: 8 }}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
