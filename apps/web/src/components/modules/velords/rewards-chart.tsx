import type { ChartConfig } from "@/components/ui/chart";
import LordsIcon from "@/components/icons/lords.svg?react";
import { Card, CardHeader } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { formatAddress, SUPPORTED_L2_CHAIN_ID } from "@/utils/utils";
import { Bar, BarChart, CartesianGrid, Line, XAxis, YAxis } from "recharts";
import { formatUnits } from "viem";

import { StakingAddresses } from "@realms-world/constants";

const sourceColors = {
  "0x045c587318c9ebcf2fbe21febf288ee2e3597a21cd48676005a5770a50d433c5":
    "hsl(36 88.9% 85.9%)",
  "0x047230028629128ac5bfbb384d32f925e70e329b624fc5d82e9c60f5746795cd":
    "hsl(120 88.9% 85.9%)",
  //Crypts: "hsl(120 88.9% 85.9%)",
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

function getSenderLabel(sender: string): string {
  if (
    sender ===
    formatAddress(StakingAddresses.velords[SUPPORTED_L2_CHAIN_ID] as string)
  ) {
    return "VeLords Exit Fees";
  }
  if (
    sender ===
    "0x045c587318c9ebcf2fbe21febf288ee2e3597a21cd48676005a5770a50d433c5"
  ) {
    return "Loot Survivor + Eternum";
  }
  return sender;
}

export function VeLordsRewardsChart({
  data,
  totalSupply,
}: {
  data?: {
    sender: string;
    amount: string;
    transaction_hash: string;
    timestamp: Date;
  }[];
  totalSupply?: number;
}) {
  const parsedData = totalSupply
    ? data
        ?.reduce(
          (acc, item) => {
            const timestamp =
              typeof item.timestamp === "number"
                ? item.timestamp
                : new Date(item.timestamp).getTime() / 1000; // seconds

            const weekStart = Math.floor(timestamp / 604800) * 604800; // seconds
            const week = new Date(weekStart * 1000).toISOString().split("T")[0];
            const existingWeek = acc.find((d) => d.week === week);

            const formattedAmount = Number(
              formatUnits(BigInt(item.amount), 18),
            );
            const senderLabel = getSenderLabel(item.sender);
            if (existingWeek) {
              // Add to existing week
              existingWeek.amounts[senderLabel] =
                (existingWeek.amounts[senderLabel] || 0) + formattedAmount;
              existingWeek.total_amount += formattedAmount;
              // Recalculate APY based on total
              existingWeek.apy =
                ((existingWeek.total_amount * 52) / totalSupply) * 100;
            } else {
              // Create new week entry
              acc.push({
                week,
                amounts: {
                  [senderLabel]: formattedAmount,
                },
                total_amount: formattedAmount,
                apy: ((formattedAmount * 52) / totalSupply) * 100,
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

  // Build all unique sender labels (not addresses)
  const allSenderLabels = Array.from(
    new Set(data?.map((item) => getSenderLabel(item.sender)) ?? []),
  );

  // Build dynamic chart config using labels
  const dynamicChartConfig: Record<
    string,
    { label: string; color: string; icon?: typeof LordsIcon }
  > &
    typeof chartConfig = {
    ...chartConfig,
    ...Object.fromEntries(
      allSenderLabels.map((label) => [
        `amounts.${label}`,
        {
          label,
          color:
            sourceColors[
              data?.find((item) => getSenderLabel(item.sender) === label)
                ?.sender as keyof typeof sourceColors
            ],
        },
      ]),
    ),
  };

  return (
    <Card>
      <CardHeader>Lords Rewards per Week</CardHeader>

      <ChartContainer
        config={dynamicChartConfig}
        className="max-h-[800px] w-full overflow-x-auto"
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
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent />} />

          {/* Stacked bars for each source (using labels) */}
          {allSenderLabels.map((label, index) => (
            <Bar
              key={label}
              dataKey={`amounts.${label}`}
              stackId="rewards"
              yAxisId="amount"
              fill={dynamicChartConfig[`amounts.${label}`].color}
              stroke={dynamicChartConfig[`amounts.${label}`].color}
              radius={
                index === allSenderLabels.length - 1
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
    </Card>
  );
}
