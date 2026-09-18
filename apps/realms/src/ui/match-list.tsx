import { formatDate, ordinal } from "./format";
import type { MatchRow } from "./match-history";

export function MatchList({ rows, empty }: { rows: readonly MatchRow[]; empty: string }) {
  if (rows.length === 0) return <div className="py-3 text-[13px] text-muted">{empty}</div>;
  return (
    <div>
      {rows.map((row) => (
        <div
          key={row.gameId}
          className="flex items-center gap-3 border-b border-line-soft py-2 text-[12.5px] last:border-b-0"
        >
          <span className="w-[70px] flex-none font-mono text-[10.5px] font-semibold text-sage">
            {ordinal(row.rank).toUpperCase()} / {row.players}
          </span>
          <span>
            {row.gameName} · {formatDate(row.endAt)}
          </span>
          <span className="ml-auto font-mono text-[12px] tabular-nums text-gold">
            {(Number(row.points) / 1_000_000).toLocaleString()} VP
          </span>
        </div>
      ))}
    </div>
  );
}
