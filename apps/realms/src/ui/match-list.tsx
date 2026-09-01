import { MMR_TOKEN_DECIMALS } from "@/services/mmr";
import { formatDate, formatLords, ordinal } from "./format";
import type { MatchRow } from "./match-history";

const signedLords = (delta: bigint): string => (delta >= 0n ? `+${formatLords(delta)}` : `−${formatLords(-delta)}`);
const signedMmr = (delta: bigint): string => {
  const value = Number(delta / MMR_TOKEN_DECIMALS);
  return value >= 0 ? `+${value}` : `−${-value}`;
};

export function MatchList({ rows, empty }: { rows: readonly MatchRow[]; empty: string }) {
  if (rows.length === 0) {
    return <div className="py-3 text-[13px] text-muted">{empty}</div>;
  }
  return (
    <div>
      {rows.map((row) => {
        const won = row.lordsDelta >= 0n;
        return (
          <div
            key={row.gameId}
            className="flex items-center gap-3 border-b border-line-soft py-2 text-[12.5px] last:border-b-0"
          >
            <span
              className={`w-[70px] flex-none font-mono text-[10.5px] font-semibold ${won ? "text-sage" : "text-coral"}`}
            >
              {ordinal(row.rank).toUpperCase()} / {row.players}
            </span>
            <span>
              {row.gameName} · {formatDate(row.endAt)}
            </span>
            <span className={`ml-auto font-mono text-[12px] tabular-nums ${won ? "text-sage" : "text-coral"}`}>
              {signedLords(row.lordsDelta)} ◆ · {signedMmr(row.mmrDelta)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
