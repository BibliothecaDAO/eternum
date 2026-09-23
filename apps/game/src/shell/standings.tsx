import { Link } from "react-router-dom";
import type { GameRef } from "@bibliothecadao/eternum/shard";

import { formatPoints, ordinal, sameAddress, shortAddress } from "./format";
import { useLeaderboard } from "./herald";
import { ErrorPanel, Loading } from "./kit";
import { useProfiles } from "./profiles";
import { portraitUrl } from "./identity-chip";

/** A game's standings from Herald: live points while it runs, the recorded result once it is settled. */
export const Standings = ({ game, highlight, limit }: { game: GameRef; highlight?: string | null; limit?: number }) => {
  const leaderboard = useLeaderboard(game);
  const entries = (leaderboard.data?.entries ?? []).slice(0, limit);
  const profileOf = useProfiles(entries.map((entry) => entry.address));

  if (leaderboard.isError)
    return (
      <ErrorPanel
        message="Standings are unavailable right now."
        error={leaderboard.error}
        retry={() => void leaderboard.refetch()}
      />
    );
  if (leaderboard.isPending) return <Loading />;
  if (entries.length === 0) return <p className="py-2 text-[13px] text-gold/60">No points recorded yet.</p>;
  return (
    <ol>
      {entries.map((entry) => {
        const profile = profileOf(entry.address);
        const isHighlighted = highlight ? sameAddress(highlight, entry.address) : false;
        return (
          <li
            key={entry.address}
            className={`flex items-center gap-3 border-t border-gold/10 py-2 text-[13px] first:border-t-0 ${isHighlighted ? "bg-gold/5" : ""}`}
          >
            <span className="w-10 font-mono text-[11px] font-semibold text-gold/70">
              {ordinal(entry.rank).toUpperCase()}
            </span>
            <img src={portraitUrl(profile?.portrait ?? null)} alt="" className="h-7 w-7 rounded object-cover" />
            <Link to={`/p/${entry.address}`} className="min-w-0 flex-1 truncate font-semibold hover:text-gold">
              {entry.name ?? profile?.name ?? shortAddress(entry.address)}
            </Link>
            <span className="font-mono text-[12px] tabular-nums text-gold">{formatPoints(entry.totalPoints)} VP</span>
          </li>
        );
      })}
    </ol>
  );
};
