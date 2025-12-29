import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import type { Payload as TooltipPayload } from "recharts/types/component/DefaultTooltipContent";
import type { TooltipContentProps } from "recharts/types/component/Tooltip";

import type { MarketClass } from "@/pm/class";
import { PMChartSkeleton, PMErrorState } from "@/pm/components/loading";
import { useMarketHistory } from "@/pm/hooks/markets/use-market-history";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip } from "@pm/ui";

// ─── Time Range Types & Utils ────────────────────────────────────────────────

type TimeRange = "1H" | "6H" | "1D" | "1W" | "1M" | "ALL";

const TIME_RANGES: TimeRange[] = ["1H", "6H", "1D", "1W", "1M", "ALL"];

const RANGE_MS: Record<TimeRange, number> = {
  "1H": 60 * 60 * 1000,
  "6H": 6 * 60 * 60 * 1000,
  "1D": 24 * 60 * 60 * 1000,
  "1W": 7 * 24 * 60 * 60 * 1000,
  "1M": 30 * 24 * 60 * 60 * 1000,
  ALL: Infinity,
};

type ChartDataPoint = Record<string, number | string>;

const filterByRange = (data: ChartDataPoint[], range: TimeRange): ChartDataPoint[] => {
  if (range === "ALL" || data.length === 0) return data;
  const cutoff = Date.now() - RANGE_MS[range];
  const filtered = data.filter((d) => (d.date as number) >= cutoff);
  // If no data in range, return at least the last point for context
  return filtered.length > 0 ? filtered : data.slice(-1);
};

const formatRangeLabel = (range: TimeRange, data: ChartDataPoint[]): string => {
  if (data.length === 0) return "";
  const first = data[0].date as number;
  const last = data[data.length - 1].date as number;

  const formatTime = (ts: number) =>
    new Date(ts).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  if (range === "1H" || range === "6H") {
    return `${formatTime(first)} – ${formatTime(last)}`;
  }

  const formatDate = (ts: number) => new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return `${formatDate(first)} – ${formatDate(last)}`;
};

// ─── Sub-components ──────────────────────────────────────────────────────────

const TimeRangePills = ({ value, onChange }: { value: TimeRange; onChange: (range: TimeRange) => void }) => (
  <div className="flex flex-wrap gap-1">
    {TIME_RANGES.map((range) => (
      <button
        key={range}
        onClick={() => onChange(range)}
        className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors sm:px-2.5 sm:py-1 sm:text-xs ${
          value === range ? "bg-gold/20 text-gold" : "text-white/50 hover:bg-white/5 hover:text-white/70"
        }`}
      >
        {range}
      </button>
    ))}
  </div>
);

const HeaderStats = ({
  title,
  focusedLabel,
  currentValue,
  changePct,
  rangeLabel,
  color,
}: {
  title: string;
  focusedLabel: string;
  currentValue: number;
  changePct: number;
  rangeLabel: string;
  color: string;
}) => {
  const isPositive = changePct >= 0;

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-sm font-medium text-white/70">{title}</span>
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: color }} />
          <span className="truncate text-sm text-white">{focusedLabel}</span>
        </span>
        {rangeLabel && <span className="text-[10px] text-white/40">{rangeLabel}</span>}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-xl font-semibold tabular-nums text-white sm:text-2xl">{currentValue.toFixed(1)}%</span>
        <span
          className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${
            isPositive ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
          }`}
        >
          {isPositive ? "+" : ""}
          {changePct.toFixed(1)}%
        </span>
      </div>
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────

export const MarketHistory = ({ market, refreshKey = 0 }: { market: MarketClass; refreshKey?: number }) => {
  const { chartData, chartConfig, isLoading, isError } = useMarketHistory(market, refreshKey);

  const [timeRange, setTimeRange] = useState<TimeRange>("ALL");
  const [focusedOutcome, setFocusedOutcome] = useState<string>("p0");
  const [hoveringDataKey, setHoveringDataKey] = useState<string | undefined>(undefined);

  // Determine effective focus (hover takes precedence)
  const effectiveFocus = hoveringDataKey ?? focusedOutcome;

  // Filter data by selected time range
  const filteredData = useMemo(() => filterByRange(chartData, timeRange), [chartData, timeRange]);

  // Compute current value and change for focused outcome
  const { currentValue, changePct, rangeLabel } = useMemo(() => {
    if (filteredData.length === 0) {
      return { currentValue: 0, changePct: 0, rangeLabel: "" };
    }

    const first = filteredData[0];
    const last = filteredData[filteredData.length - 1];
    const current = Number(last[effectiveFocus] ?? 0);
    const baseline = Number(first[effectiveFocus] ?? 0);
    const change = current - baseline;

    return {
      currentValue: current,
      changePct: change,
      rangeLabel: formatRangeLabel(timeRange, filteredData),
    };
  }, [filteredData, effectiveFocus, timeRange]);

  // Get focused outcome label and color
  const focusedConfig = chartConfig[effectiveFocus as keyof typeof chartConfig];
  const focusedLabel = (focusedConfig?.label as string) || effectiveFocus;
  const focusedColor = focusedConfig?.color || "#888";

  // Loading state
  if (isLoading) {
    return <PMChartSkeleton />;
  }

  // Error state
  if (isError) {
    return <PMErrorState message="Failed to load market history" />;
  }

  // Empty state
  if (chartData.length === 0) {
    return (
      <div className="w-full rounded-lg border border-dashed border-white/10 bg-black/40 px-4 py-5 text-sm text-gold/70 shadow-inner">
        <p className="text-white">Market history</p>
        <p className="mt-1 text-xs text-gold/60">Price history will appear once trading begins.</p>
      </div>
    );
  }

  const minTime = Math.min(...filteredData.map((i) => i.date as number));
  const maxTime = Math.max(...filteredData.map((i) => i.date as number));

  const maxValue = Math.max(
    ...filteredData.map((item) => {
      const values = new Array(market.outcome_slot_count).fill(0).map((_i, idx) => Number(item[`p${idx}`]));
      return Math.max(...values);
    }),
  );

  // Smart X-axis formatting based on time range
  const formatXAxis = (value: number) => {
    const date = new Date(value);
    if (timeRange === "1H" || timeRange === "6H") {
      return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    }
    if (timeRange === "1D") {
      return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    }
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const renderTooltip = ({ active, payload }: TooltipContentProps<number, string>) => {
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
      .filter((item): item is TooltipPayload<number, string> & { dataKey: string } => typeof item.dataKey === "string")
      .sort((a, b) => Number(b.value ?? 0) - Number(a.value ?? 0));

    return (
      <div className="min-w-[200px] rounded-lg border border-white/10 bg-black/95 px-3 py-2 shadow-xl backdrop-blur">
        {formattedDate && (
          <div className="mb-2 border-b border-white/5 pb-1.5 text-[10px] uppercase tracking-[0.08em] text-white/50">
            {formattedDate}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          {playerPayloads.map((item) => {
            const dataKey = item.dataKey as string;
            const config = chartConfig[dataKey as keyof typeof chartConfig];
            const color = config?.color || (item as any).color;
            const isFocused = dataKey === effectiveFocus;

            return (
              <div
                key={dataKey}
                className={`flex items-center justify-between gap-3 ${isFocused ? "opacity-100" : "opacity-60"}`}
              >
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: color }} />
                  <span className="text-xs text-white">{config?.label || dataKey}</span>
                </div>
                <span className="text-xs font-mono font-semibold text-white">
                  {Number(item.value ?? 0).toFixed(1)}%
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
      {/* Header with stats and time range pills */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <HeaderStats
          title="Market history"
          focusedLabel={focusedLabel}
          currentValue={currentValue}
          changePct={changePct}
          rangeLabel={rangeLabel}
          color={focusedColor}
        />
        <div className="shrink-0">
          <TimeRangePills value={timeRange} onChange={setTimeRange} />
        </div>
      </div>

      {/* Chart */}
      <ChartContainer config={chartConfig} className="h-[320px] w-full">
        <LineChart
          data={filteredData}
          margin={{
            top: 12,
            right: 24,
            left: 4,
            bottom: 0,
          }}
        >
          {/* Gradient definitions for area fill (optional, for focused line) */}
          <defs>
            {new Array(market.outcome_slot_count).fill(0).map((_i, idx) => (
              <linearGradient key={idx} id={`gradient-p${idx}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={`var(--color-p${idx})`} stopOpacity={0.15} />
                <stop offset="100%" stopColor={`var(--color-p${idx})`} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>

          {/* Minimal grid */}
          <CartesianGrid vertical={false} strokeDasharray="3 3" strokeOpacity={0.08} />

          {/* X-axis with smart formatting */}
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            type="number"
            scale="time"
            domain={[minTime, maxTime + (maxTime - minTime) * 0.02]}
            tickFormatter={formatXAxis}
            tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
          />

          {/* Sparse Y-axis */}
          <YAxis
            tickLine={false}
            axisLine={false}
            tickCount={5}
            domain={[0, Math.min(100, maxValue + 10)]}
            width={28}
            tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
            tickFormatter={(v) => `${v}%`}
          />

          {/* Lines for each outcome */}
          {new Array(market.outcome_slot_count).fill(0).map((_i, idx) => {
            const key = `p${idx}`;
            const isFocused = effectiveFocus === key;
            const color = `var(--color-p${idx})`;

            return (
              <Line
                key={idx}
                dataKey={key}
                type="monotone"
                stroke={color}
                strokeWidth={isFocused ? 2 : 1.5}
                strokeOpacity={!hoveringDataKey || isFocused ? 1 : 0.2}
                dot={false}
                activeDot={{
                  r: isFocused ? 5 : 4,
                  strokeWidth: 2,
                  stroke: color,
                  fill: "#0a0a0a",
                  style: isFocused ? { filter: "drop-shadow(0 0 4px rgba(255,255,255,0.3))" } : undefined,
                }}
                animationDuration={200}
              />
            );
          })}

          {/* Tooltip with vertical cursor line */}
          <ChartTooltip
            content={renderTooltip}
            cursor={{
              stroke: "rgba(255,255,255,0.15)",
              strokeWidth: 1,
              strokeDasharray: "4 4",
            }}
          />

          {/* Legend with hover and click-to-lock interaction */}
          <ChartLegend
            wrapperStyle={{ paddingTop: 16 }}
            content={
              <ChartLegendContent
                className="flex flex-wrap justify-center gap-4"
                mouseEnter={(e) => setHoveringDataKey(e.dataKey as string)}
                mouseLeave={() => setHoveringDataKey(undefined)}
                onItemClick={(e) => setFocusedOutcome(e.dataKey as string)}
              />
            }
          />
        </LineChart>
      </ChartContainer>
    </div>
  );
};
