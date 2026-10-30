import { formatExact } from "@bibliothecadao/types";
import type { HeraldFrontierLeaderboard } from "@bibliothecadao/eternum/game-sync";

import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Icon } from "@/ui/design-system/icon";
import { PlaceMedal } from "@/ui/design-system/kit/place-medal";
import { PlayerName } from "@/ui/design-system/kit/player-name";
import { POOL_NOT_PUBLISHED, PRIZE_UNHELD, SEASON_PRIZES } from "@/ui/design-system/kit/words";
import { type PodiumPlace, seasonPodium } from "@/ui/features/frontier/board/season-pool";

/**
 * A Frontier season's top prizes over its board, on the app's Season tab and on a finished season's Results (the
 * owner's pick A, 30 October 2026): a tile per prize place, second, first and third, the first raised; its medal, its
 * LORDS and who holds it (seasonPodium), or why no one does yet. While no pool is published,
 * the medals stand with "—" and say so; with no place paid, nothing.
 */
export const SeasonPodium = ({
  board,
  own,
}: {
  board: HeraldFrontierLeaderboard;
  /** The player's own address, whose name reads as theirs. */
  own: string | undefined;
}) => {
  const podium = seasonPodium(board);
  if (podium?.length === 0) return null;
  const places: PodiumPlace[] = podium ?? [1, 2, 3].map((place) => ({ place, lords: Number.NaN, holder: "open" }));
  return (
    <ol aria-label={SEASON_PRIZES} className="grid grid-cols-3 items-end gap-2 px-4 py-3">
      {[places[1], places[0], ...places.slice(2)].map(
        (place) =>
          place && (
            <li
              key={place.place}
              data-place={place.place}
              className={cn(
                "flex min-w-0 flex-col items-center gap-1 rounded-lg border border-app-line bg-app-well px-2 py-2",
                place.place === 1 && "py-4",
              )}
            >
              <PlaceMedal place={place.place} size={place.place === 1 ? 34 : 28} below={`#${place.place}`} />
              <span className="inline-flex items-center gap-1 text-app-strong tabular-nums text-app-gold">
                <Icon name="lords" size={18} />
                {Number.isNaN(place.lords) ? "—" : formatExact(place.lords)}
              </span>
              {podium !== null && (
                <span
                  className={cn(
                    "max-w-full truncate text-app-label",
                    typeof place.holder === "string" ? "text-app-muted" : "text-app-ink",
                  )}
                >
                  {typeof place.holder === "string" ? (
                    PRIZE_UNHELD[place.holder]
                  ) : (
                    <PlayerName account={place.holder.address} you={place.holder.address === own} />
                  )}
                </span>
              )}
            </li>
          ),
      )}
      {podium === null && (
        <li className="col-span-3 text-center text-app-label text-app-muted">{POOL_NOT_PUBLISHED}</li>
      )}
    </ol>
  );
};
