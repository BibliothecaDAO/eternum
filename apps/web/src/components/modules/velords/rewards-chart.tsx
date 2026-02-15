import type { ChartConfig } from "@/components/ui/chart";
import { useMemo, useState } from "react";
import LordsIcon from "@/components/icons/lords.svg?react";
import { Card, CardHeader } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Label } from "@/components/ui/label";
import { getVelordsSourceLabel } from "@/lib/velords-sources";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Bar, BarChart, CartesianGrid, Line, XAxis, YAxis } from "recharts";
import { formatUnits } from "viem";

const sourceColors = {
  "0x045c587318c9ebcf2fbe21febf288ee2e3597a21cd48676005a5770a50d433c5":
    "hsl(120 88.9% 85.9%)",
  "0x047230028629128ac5bfbb384d32f925e70e329b624fc5d82e9c60f5746795cd":
    "hsl(36 88.9% 85.9%)",
  //Crypts: "hsl(120 88.9% 85.9%)",
  // Add more sources and colors as needed
} as const;

const fallbackSourceColors = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

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
  totalSupplyRaw,
  selectedPeriod,
  onTimePeriodChange,
  isLoading = false,
  errorMessage,
}: {
  data?: {
    sender: string;
    amount: string;
    transaction_hash: string;
    timestamp: Date;
  }[];
  totalSupplyRaw?: bigint;
  selectedPeriod?: "3m" | "6m" | "1y";
  onTimePeriodChange?: (period: "3m" | "6m" | "1y") => void;
  isLoading?: boolean;
  errorMessage?: string;
}) {
  const [localSelectedPeriod, setLocalSelectedPeriod] = useState<"3m" | "6m" | "1y">(
    "3m",
  );
  const currentSelectedPeriod = selectedPeriod ?? localSelectedPeriod;

  const handlePeriodChange = (value: string) => {
    const period = value as "3m" | "6m" | "1y";
    setLocalSelectedPeriod(period);
    onTimePeriodChange?.(period);
  };

  const parsedData = useMemo(() => {
    if (!data || data.length === 0) return [];
    const totalSupply = totalSupplyRaw
      ? Number(formatUnits(totalSupplyRaw, 18))
      : undefined;

    // Find the date range
    const timestamps = data
      .map((item) =>
        typeof item.timestamp === "number"
          ? item.timestamp
          : new Date(item.timestamp).getTime() / 1000,
      )
      .filter((timestamp): timestamp is number => Number.isFinite(timestamp));
    if (timestamps.length === 0) return [];
    const minTimestamp = Math.min(...timestamps);
    const maxTimestamp = Math.max(...timestamps);

    interface WeeklyRewardRow {
      week: string;
      amounts: Record<string, number>;
      total_amount: number;
      apy: number;
    }

    // Generate all weeks in the range
    const allWeeks: Partial<Record<string, WeeklyRewardRow>> = {};

    // Pre-populate all weeks with zero values
    for (
      let timestamp = minTimestamp;
      timestamp <= maxTimestamp;
      timestamp += 604800
    ) {
      const weekStart = Math.floor(timestamp / 604800) * 604800;
      const week = new Date(weekStart * 1000).toISOString().split("T")[0];
      allWeeks[week] = {
        week,
        amounts: {},
        total_amount: 0,
        apy: 0,
      };
    }

    // Fill in the actual data
    data.forEach((item) => {
      const timestamp =
        typeof item.timestamp === "number"
          ? item.timestamp
          : new Date(item.timestamp).getTime() / 1000;
      if (!Number.isFinite(timestamp)) return;

      const weekStart = Math.floor(timestamp / 604800) * 604800;
      const week = new Date(weekStart * 1000).toISOString().split("T")[0];
      allWeeks[week] ??= {
        week,
        amounts: {},
        total_amount: 0,
        apy: 0,
      };

      const formattedAmount = Number(formatUnits(BigInt(item.amount), 18));
      const senderLabel = getVelordsSourceLabel(item.sender);

      const weekData = allWeeks[week];
      weekData.amounts[senderLabel] = (weekData.amounts[senderLabel] || 0) + formattedAmount;
      weekData.total_amount += formattedAmount;
      weekData.apy =
        totalSupply && totalSupply > 0
          ? ((weekData.total_amount * 52) / totalSupply) * 100
          : 0;
    });

    return Object.values(allWeeks)
      .filter((row): row is WeeklyRewardRow => row !== undefined)
      .sort((a, b) => a.week.localeCompare(b.week));
  }, [data, totalSupplyRaw]);

  const allSenderLabels = useMemo(
    () => Array.from(new Set(data?.map((item) => getVelordsSourceLabel(item.sender)) ?? [])),
    [data],
  );

  // Build dynamic chart config using labels
  const dynamicChartConfig: Record<
    string,
      { label: string; color: string; icon?: typeof LordsIcon }
  > &
    typeof chartConfig = {
    ...chartConfig,
    ...Object.fromEntries(
      allSenderLabels.map((label, index) => [
        `amounts.${label}`,
        {
          label,
          color: (() => {
            const senderAddress = data?.find(
              (item) => getVelordsSourceLabel(item.sender) === label,
            )?.sender;
            const knownColor = senderAddress
              ? sourceColors[senderAddress as keyof typeof sourceColors]
              : undefined;
            return knownColor ?? fallbackSourceColors[index % fallbackSourceColors.length];
          })(),
        },
      ]),
    ),
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>Lords Rewards per Week</div>
        <div className="flex items-center space-x-4">
          <Label htmlFor="time-period" className="text-sm font-medium">
            Time Period:
          </Label>
          <RadioGroup
            value={currentSelectedPeriod}
            onValueChange={handlePeriodChange}
            className="flex space-x-2"
          >
            <div className="flex items-center space-x-1">
              <RadioGroupItem value="3m" id="3m" />
              <Label htmlFor="3m" className="text-sm">
                3m
              </Label>
            </div>
            <div className="flex items-center space-x-1">
              <RadioGroupItem value="6m" id="6m" />
              <Label htmlFor="6m" className="text-sm">
                6m
              </Label>
            </div>
            <div className="flex items-center space-x-1">
              <RadioGroupItem value="1y" id="1y" />
              <Label htmlFor="1y" className="text-sm">
                1y
              </Label>
            </div>
          </RadioGroup>
        </div>
      </CardHeader>

      <ChartContainer
        config={dynamicChartConfig}
        className="max-h-[800px] w-full overflow-x-auto"
      >
        {errorMessage ? (
          <div className="text-destructive p-6 text-sm">{errorMessage}</div>
        ) : isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading chart data...</div>
        ) : parsedData.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">
            No rewards data is available for this period.
          </div>
        ) : (
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
        )}
      </ChartContainer>
    </Card>
  );
}
