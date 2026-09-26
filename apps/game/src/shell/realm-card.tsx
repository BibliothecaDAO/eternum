import { getRealmNameById } from "@bibliothecadao/eternum";
import { Trophy } from "@/ui/design-system/atoms/game-icons";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Chip } from "@/ui/features/frontier/frontier-chips";
import { formatAmount } from "@/ui/features/frontier/frontier-format";
import { DayDial } from "@/ui/features/frontier/day-dial";
import { FlagGlyph } from "@/ui/features/frontier/glyphs";
import { orderEmblem } from "@/ui/features/frontier/board/order-emblem";
import { normalizeLeaderboardAddress } from "@/services/leaderboard/landing-leaderboard-service";

import { entryHref } from "./game-links";
import { type DirectoryGame, useLeaderboard, useRealmsPlayer } from "./herald";
import { PrimaryLink } from "./live-chips";
import { realmStill } from "./mode-art";
import { seasonRealm } from "./season";
import { useNowSeconds } from "./use-now";

/**
 * The player's realm (design o2, o10): its castle at its tier on its board, its name under its Order's emblem, the
 * expedition day's dial, today's rank and sites cleared from the season board, and Resume into it.
 */
export const RealmCard = ({ season, className }: { season: DirectoryGame; className?: string }) => {
  const player = useRealmsPlayer();
  const realm = seasonRealm(season);
  const board = useLeaderboard({ chainId: season.chainId, gameId: season.game_id });
  const now = useNowSeconds();
  if (!realm) return null;
  const still = realmStill(realm.level);
  const own =
    board.data?.mode === "frontier"
      ? board.data.entries.find(
          (entry) =>
            player !== null && normalizeLeaderboardAddress(entry.address) === normalizeLeaderboardAddress(player),
        )
      : undefined;
  const emblem = own && orderEmblem(own.order);
  return (
    <article
      aria-label={getRealmNameById(realm.realm_id)}
      className={cn(
        "relative isolate flex min-h-60 flex-col justify-between gap-3 overflow-hidden rounded-2xl border",
        "border-[#46351c] p-3 lg:min-h-64 lg:p-4",
        className,
      )}
    >
      {still && <img src={still} alt="" className="absolute inset-0 -z-10 size-full object-cover object-[45%_55%]" />}
      <span className="absolute inset-0 -z-10 bg-gradient-to-t from-[#0c0a08] via-[#0c0a08]/50 to-transparent" />
      <header className="flex items-center gap-2">
        {emblem ? <img src={emblem.art} alt={emblem.name} className="size-8 object-contain" /> : null}
        <h2 className="font-[Lexend] text-[22px] font-extrabold text-[#fff3c4] drop-shadow-[0_2px_0_#1b1207]">
          {getRealmNameById(realm.realm_id)}
        </h2>
        {season.expedition && (
          <DayDial
            rules={{ epochSeconds: season.expedition.epoch_seconds, startMainAt: season.clock.start_main_at }}
            now={now}
            className="ml-auto"
          />
        )}
      </header>
      {/* A phone stacks the numbers over Resume; a wide card sets them side by side, Resume at the right. */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <Chip small label="Season rank" icon={<Trophy />} value={own ? `#${own.rank}` : "—"} />
          <Chip
            small
            label="Sites cleared"
            icon={<FlagGlyph />}
            value={own ? formatAmount(own.sites_cleared.total) : "—"}
          />
        </div>
        <div className="lg:w-56">
          <PrimaryLink to={entryHref(season, "play")}>Resume</PrimaryLink>
        </div>
      </div>
    </article>
  );
};
