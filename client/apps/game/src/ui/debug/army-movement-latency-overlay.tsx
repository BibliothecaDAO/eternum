import {
  summarizeArmyMovementLatency,
  type ArmyMovementLatencyPhasePairSummary,
  type ArmyMovementLatencySummary,
} from "@bibliothecadao/eternum";
import { useEffect, useMemo, useState } from "react";

const REFRESH_INTERVAL_MS = 1000;
const QUERY_PARAM = "debugMovementLatency";

export function isArmyMovementLatencyOverlayEnabled(search: string = window.location.search): boolean {
  const params = new URLSearchParams(search);
  const value = params.get(QUERY_PARAM);
  if (value === null) return false;
  return value !== "0" && value.toLowerCase() !== "false";
}

function formatMs(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "-";
  if (ms < 10) return `${ms.toFixed(1)}ms`;
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function phasePairLabel(pair: ArmyMovementLatencyPhasePairSummary["pair"]): string {
  return `${pair.from} → ${pair.to}`;
}

export function ArmyMovementLatencyOverlay(): JSX.Element | null {
  const enabled = useMemo(() => isArmyMovementLatencyOverlayEnabled(), []);
  const [summary, setSummary] = useState<ArmyMovementLatencySummary | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    const refresh = () => {
      if (cancelled) return;
      setSummary(summarizeArmyMovementLatency());
    };

    refresh();
    const intervalId = window.setInterval(refresh, REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [enabled]);

  if (!enabled || !summary) return null;

  const populatedPairs = summary.phasePairs.filter((p) => p.count > 0);

  return (
    <div
      className="fixed bottom-4 left-4 z-[9999] pointer-events-auto bg-black/80 text-white text-xs font-mono rounded-md shadow-xl border border-gold/40 p-3 max-w-[640px] max-h-[60vh] overflow-auto"
      data-testid="army-movement-latency-overlay"
    >
      <div className="flex items-center justify-between mb-2 pb-1 border-b border-gold/30">
        <span className="text-gold font-semibold">Army Movement Latency</span>
        <span className="text-white/60">samples: {summary.sampleCount}</span>
      </div>
      {populatedPairs.length === 0 ? (
        <div className="text-white/60">No samples yet. Move an army to populate.</div>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-left text-white/60">
              <th className="py-0.5 pr-2 font-normal">phase pair</th>
              <th className="py-0.5 px-1 font-normal text-right">n</th>
              <th className="py-0.5 px-1 font-normal text-right">p50</th>
              <th className="py-0.5 px-1 font-normal text-right">p95</th>
              <th className="py-0.5 px-1 font-normal text-right">p99</th>
              <th className="py-0.5 pl-1 font-normal text-right">max</th>
            </tr>
          </thead>
          <tbody>
            {populatedPairs.map((pair) => (
              <tr key={phasePairLabel(pair.pair)} className="border-t border-white/10">
                <td className="py-0.5 pr-2 text-white/90">{phasePairLabel(pair.pair)}</td>
                <td className="py-0.5 px-1 text-right">{pair.count}</td>
                <td className="py-0.5 px-1 text-right">{formatMs(pair.p50Ms)}</td>
                <td className="py-0.5 px-1 text-right">{formatMs(pair.p95Ms)}</td>
                <td className="py-0.5 px-1 text-right">{formatMs(pair.p99Ms)}</td>
                <td className="py-0.5 pl-1 text-right text-white/70">{formatMs(pair.maxMs)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
