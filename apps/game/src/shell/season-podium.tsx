import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Chip } from "@/ui/features/frontier/frontier-chips";
import { formatAmount } from "@/ui/features/frontier/frontier-format";
import { FlagGlyph } from "@/ui/features/frontier/glyphs";
import { orderEmblem } from "@/ui/features/frontier/board/order-emblem";
import type { HeraldFrontierLeaderboardEntry } from "@bibliothecadao/eternum/game-sync";

import type { DirectoryGame } from "./herald";
import { useLeaderboard } from "./herald";
import { portraitUrl } from "./identity-chip";
import { useProfiles } from "./profiles";

/** The podium's plinths left to right, second, first, third, as a podium stands. */
const PODIUM = [
  { place: 2, height: "h-14", plinth: "from-[#dcdfe4] to-[#7c828c]" },
  { place: 1, height: "h-20", plinth: "from-[#f6c54a] to-[#a86e00]" },
  { place: 3, height: "h-10", plinth: "from-[#d8905a] to-[#86481f]" },
] as const;

/**
 * The season's top three on a podium (design o1, o10): each leader's portrait and Order emblem over their plinth, and
 * their sites cleared. Herald ranks; unknown leaders stand as empty plinths.
 */
export const SeasonPodium = ({ season, className }: { season: DirectoryGame; className?: string }) => {
  const board = useLeaderboard({ chainId: season.chainId, gameId: season.game_id });
  const entries = board.data?.mode === "frontier" ? board.data.entries : undefined;
  const profiles = useProfiles((entries ?? []).slice(0, 3).map((entry) => entry.address));
  return (
    <section aria-label="Season" className={cn("frontier-card flex flex-col gap-2 p-3 lg:p-4", className)}>
      <h2 className="font-[Lexend] text-[17px] font-extrabold text-[#eadfc8]">Season</h2>
      <ol className="grid grid-cols-3 items-end gap-2">
        {PODIUM.map(({ place, height, plinth }) => (
          <Leader
            key={place}
            entry={entries?.[place - 1]}
            place={place}
            height={height}
            plinth={plinth}
            portrait={(address) => profiles(address).portrait}
          />
        ))}
      </ol>
    </section>
  );
};

const Leader = ({
  entry,
  place,
  height,
  plinth,
  portrait,
}: {
  entry: HeraldFrontierLeaderboardEntry | undefined;
  place: number;
  height: string;
  plinth: string;
  portrait: (address: string) => string | null;
}) => {
  const emblem = entry && orderEmblem(entry.order);
  return (
    <li className="flex flex-col items-center gap-1" aria-label={`Place ${place}`}>
      {entry ? (
        <img
          src={portraitUrl(portrait(entry.address))}
          alt=""
          className={cn(
            "size-12 rounded-full border-2 object-cover",
            place === 1 ? "border-[#f6ac1d]" : "border-[#6b5230]",
          )}
        />
      ) : (
        <span className="size-12 rounded-full border-2 border-dashed border-[#46351c]" />
      )}
      {emblem ? (
        <img src={emblem.art} alt={emblem.name} className="size-7 object-contain" />
      ) : (
        <span className="size-7" />
      )}
      <span
        className={cn(
          "flex w-full items-start justify-center rounded-t-lg bg-gradient-to-b pt-1 font-[Lexend] text-[20px] font-extrabold text-[#1b1207]",
          height,
          entry ? plinth : "from-[#2a2013] to-[#15100a] text-[#6e6148]",
        )}
      >
        {place}
      </span>
      <Chip
        small
        label="Sites cleared"
        icon={<FlagGlyph />}
        value={entry ? formatAmount(entry.sites_cleared.total) : "—"}
      />
    </li>
  );
};
