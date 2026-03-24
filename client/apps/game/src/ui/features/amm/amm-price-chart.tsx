import { useAmm } from "@/hooks/use-amm";
import { useAmmStore } from "@/hooks/store/use-amm-store";
import { useQuery } from "@tanstack/react-query";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import {
  AreaSeries,
  ColorType,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CandleInterval, PriceCandle } from "@bibliothecadao/amm-sdk";
import { resolveAmmAssetPresentation } from "./amm-asset-presentation";
import { formatAmmCompactAmount, formatAmmSpotPrice } from "./amm-format";

const INTERVALS: { label: string; value: CandleInterval }[] = [
  { label: "1h", value: "1h" },
  { label: "4h", value: "4h" },
  { label: "1d", value: "1d" },
];

export const AmmPriceChart = () => {
  const { client, config, isConfigured } = useAmm();
  const selectedPool = useAmmStore((s) => s.selectedPool);
  const [interval, setInterval] = useState<CandleInterval>("1h");
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area", Time> | null>(null);

  const { data: candles, isLoading } = useQuery<PriceCandle[]>({
    queryKey: ["amm-candles", selectedPool, interval],
    queryFn: async () => {
      if (!selectedPool || !client) return [];
      return client.api.getPriceHistory(selectedPool, interval);
    },
    enabled: Boolean(client) && Boolean(selectedPool),
    retry: false,
    refetchOnWindowFocus: false,
  });

  const { data: stats } = useQuery({
    queryKey: ["amm-pool-stats", selectedPool],
    queryFn: async () => {
      if (!selectedPool || !client) return null;
      return client.api.getPoolStats(selectedPool);
    },
    enabled: Boolean(client) && Boolean(selectedPool),
    retry: false,
    refetchOnWindowFocus: false,
  });

  const chartData = useMemo(
    () =>
      (candles ?? []).map((candle) => ({
        time: candle.timestamp as UTCTimestamp,
        value: candle.close,
      })),
    [candles],
  );

  useEffect(() => {
    if (!chartContainerRef.current || !selectedPool) {
      return;
    }

    const container = chartContainerRef.current;
    const chart = createChart(container, {
      autoSize: true,
      height: 260,
      layout: {
        textColor: "rgba(223, 170, 84, 0.82)",
        background: { type: ColorType.Solid, color: "transparent" },
      },
      grid: {
        vertLines: { color: "rgba(223, 170, 84, 0.05)" },
        horzLines: { color: "rgba(223, 170, 84, 0.07)" },
      },
      crosshair: {
        vertLine: {
          color: "rgba(223, 170, 84, 0.22)",
          labelBackgroundColor: "#dfaa54",
        },
        horzLine: {
          color: "rgba(223, 170, 84, 0.22)",
          labelBackgroundColor: "#dfaa54",
        },
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.15, bottom: 0.1 },
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        axisPressedMouseMove: true,
        pinch: true,
        mouseWheel: true,
      },
    });
    const areaSeries = chart.addSeries(AreaSeries, {
      lineColor: "#dfaa54",
      topColor: "rgba(223, 170, 84, 0.32)",
      bottomColor: "rgba(223, 170, 84, 0.03)",
      lineWidth: 2,
      crosshairMarkerVisible: true,
      lastValueVisible: false,
      priceLineVisible: false,
    });

    chartRef.current = chart;
    seriesRef.current = areaSeries;

    const resizeObserver = new ResizeObserver(() => {
      chart.applyOptions({ width: container.clientWidth });
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [selectedPool, chartData.length]);

  useEffect(() => {
    if (!seriesRef.current) {
      return;
    }

    seriesRef.current.setData(chartData);
    chartRef.current?.timeScale().fitContent();
  }, [chartData]);

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-gold/10 bg-black/25 p-4 text-center text-gold/60 text-sm backdrop-blur-[8px]">
        <div className="w-4 h-4 border-t-2 border-gold rounded-full animate-spin mx-auto mb-2" />
        Loading chart...
      </div>
    );
  }

  if (!isConfigured || !client) {
    return (
      <div className="rounded-2xl border border-gold/10 bg-black/25 p-4 backdrop-blur-[8px]">
        <div className="flex items-center justify-center h-[200px] text-gold/40 text-sm">AMM is not configured</div>
      </div>
    );
  }

  const activeAsset = selectedPool ? resolveAmmAssetPresentation(selectedPool, config.lordsAddress) : null;

  return (
    <div className="rounded-2xl border border-gold/10 bg-black/25 p-4 backdrop-blur-[8px]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-gold/10 bg-black/35">
            {activeAsset?.iconResource ? (
              <ResourceIcon resource={activeAsset.iconResource} size="sm" withTooltip={false} className="!h-6 !w-6" />
            ) : (
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gold/70">
                {activeAsset?.shortLabel.slice(0, 2) ?? "--"}
              </span>
            )}
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-gold">
              {activeAsset ? `${activeAsset.displayName} Chart` : "Price Chart"}
            </h3>
            <div className="mt-1 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.12em] text-gold/45">
              <span>{stats ? `${formatAmmSpotPrice(stats.spotPrice)} LORDS` : "No price"}</span>
              <span>{stats ? `${formatAmmCompactAmount(stats.tvlLords)} TVL` : "TVL --"}</span>
              <span>{stats ? `${formatAmmCompactAmount(stats.volume24h)} VOL 24H` : "VOL --"}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-1">
          {INTERVALS.map((int) => (
            <button
              key={int.value}
              className={`rounded-xl px-2 py-1 text-xs transition-colors ${
                interval === int.value ? "bg-gold/20 text-gold" : "text-gold/60 hover:text-gold hover:bg-gold/10"
              }`}
              onClick={() => setInterval(int.value)}
            >
              {int.label}
            </button>
          ))}
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="flex h-[260px] items-center justify-center text-gold/40 text-sm">
          {selectedPool ? "No price data available" : "Select a pool to view chart"}
        </div>
      ) : chartData.length < 3 ? (
        <div className="flex h-[260px] flex-col items-center justify-center gap-2">
          <div className="text-2xl font-bold text-gold">
            {formatAmmSpotPrice(chartData[chartData.length - 1]?.value ?? stats?.spotPrice ?? 0)} LORDS
          </div>
          <div className="text-xs text-gold/40">Not enough data points for chart — check back soon</div>
        </div>
      ) : (
        <div>
          <div className="mb-2 text-lg font-bold text-gold">
            {formatAmmSpotPrice(chartData[chartData.length - 1]?.value ?? stats?.spotPrice ?? 0)} LORDS
          </div>
          <div ref={chartContainerRef} className="h-[260px] w-full" />
        </div>
      )}
    </div>
  );
};
