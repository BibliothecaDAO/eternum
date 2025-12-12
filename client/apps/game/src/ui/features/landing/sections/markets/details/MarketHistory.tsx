import React, { useState } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis, type TooltipProps } from "recharts";

import type { MarketClass } from "@/pm/class";
import { useMarketHistory } from "@/pm/hooks/markets/useMarketHistory";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
} from "@pm/ui";

export const MarketHistory = ({ market }: { market: MarketClass }) => {
  const { chartData, chartConfig } = useMarketHistory(market);

  const [hoveringDataKey, setHoveringDataKey] = useState<string | undefined>(undefined);

  if (chartData.length === 0) {
    return (
      <div className="w-full rounded-lg border border-dashed border-white/10 bg-black/40 px-4 py-5 text-sm text-gold/70 shadow-inner">
        <p className="text-white">Market history</p>
        <p className="mt-1 text-xs text-gold/60">Price history will appear once trading begins.</p>
      </div>
    );
  }

  const minTime = Math.min(...chartData.map((i) => i.date));
  const maxTime = Math.max(...chartData.map((i) => i.date));

  const maxValue = Math.max(
    ...chartData.map((item) => {
      const values = new Array(market.outcome_slot_count).fill(0).map((_i, idx) => Number(item[`p${idx}`]));

      return Math.max(...values);
    }),
  );

  const renderTooltip = ({ active, payload }: TooltipProps<number, string>) => {
    if (!active || !payload?.length) return null;

    const tooltipDate = payload?.[0]?.payload?.date as number | undefined;
    const formattedDate = tooltipDate
      ? new Date(tooltipDate).toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : undefined;

    const playerPayloads = payload
      .filter((item) => typeof item.dataKey === "string")
      .sort((a, b) => Number(b.value ?? 0) - Number(a.value ?? 0));

    return (
      <div className="min-w-[220px] rounded-lg border border-white/10 bg-black/90 px-3 py-2 shadow-xl backdrop-blur">
        {formattedDate ? (
          <div className="mb-2 text-[11px] uppercase tracking-[0.08em] text-gold/70">{formattedDate}</div>
        ) : null}

        <div className="flex flex-col gap-2">
          {playerPayloads.map((item) => {
            const dataKey = item.dataKey as string;
            const config = chartConfig[dataKey as keyof typeof chartConfig];
            const color = config?.color || (item as any).color;

            return (
              <div key={dataKey} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: color }} />
                  <span className="text-xs text-white">{config?.label || dataKey}</span>
                </div>
                <span className="text-xs font-mono font-semibold text-white">
                  {Number(item.value ?? 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full rounded-lg border border-white/10 bg-black/40 p-4 shadow-inner">
      <div className="mb-3">
        <p className="text-xs uppercase tracking-[0.08em] text-gold/70">Market history</p>
        <p className="text-lg font-semibold text-white">Price movement</p>
      </div>
      <ChartContainer config={chartConfig} className="h-[640px] w-full">
        <LineChart
          data={chartData}
          margin={{
            left: 0,
            right: 0,
          }}
        >
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tickMargin={2}
            type="number"
            scale="time"
            domain={[minTime, maxTime + 2 * 60 * 1_000]}
            tickFormatter={(value) => {
              const date = new Date(value);
              return date.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              });
            }}
          />
          <YAxis
            tickCount={Math.ceil(maxValue + 5) / 10}
            ticks={[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]}
            domain={[0, maxValue + 5]}
            width={30}
          />

          {new Array(market.outcome_slot_count).fill(0).map((_i, idx) => {
            return (
              <Line
                animationDuration={0}
                key={idx}
                dataKey={`p${idx}`}
                strokeOpacity={!hoveringDataKey || hoveringDataKey === `p${idx}` ? 1 : 0.25}
                type="linear"
                stroke={`var(--color-p${idx})`}
                strokeWidth={1}
                dot={false}
              />
            );
          })}

          <ChartTooltip
            content={renderTooltip}
          />

          <ChartLegend
            className="flex-row flex-wrap items-start gap-3"
            content={
              <ChartLegendContent
                mouseEnter={(e) => setHoveringDataKey(e.dataKey as string)}
                mouseLeave={() => setHoveringDataKey(undefined)}
              />
            }
          />
        </LineChart>
      </ChartContainer>
    </div>
  );
};
