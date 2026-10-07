import { cn } from "@/ui/design-system/atoms/lib/utils";
import { formatAmount } from "@/ui/design-system/kit/amount";
import { Button } from "@/ui/design-system/kit/button";
import { KitIcon } from "@/ui/design-system/kit/kit-icon";
import { EXIT, REACH_NUMERALS, SEASON, SEASON_ENDINGS, SEASON_OVER, YOU_PLACED } from "@/ui/design-system/kit/words";
import type { ReactNode } from "react";

import { TotalsGrid } from "../log/day-totals";

/** One of the season's first three: its place, the player's name drawn by the one rule, and sites cleared. */
export type PodiumPlace = { key: string; rank: number; name: ReactNode; sitesCleared: number };

/** The player's season in totals, as Herald counts it. */
export type SeasonTotals = {
  sitesCleared: number;
  chests: number;
  lords: number;
  /** The deepest reach beyond the spire, 1 to 3; 0 for none. */
  reach: number;
  essence: number;
  labor: number;
};

/**
 * Season over (wireframe 12), told one of two ways: the mist lifted, or it grew too strong. The place is the hero, of
 * the field; then the podium, the player's season in totals, and Exit with Season beside it. A player without a place
 * (a spectator) sees the ending and the podium.
 */
export const SeasonOverCard = ({
  ending,
  place,
  field,
  podium,
  totals,
  onSeason,
  onExit,
}: {
  ending: keyof typeof SEASON_ENDINGS;
  place: number | undefined;
  field: number | undefined;
  podium: readonly PodiumPlace[];
  totals: SeasonTotals | undefined;
  onSeason: () => void;
  onExit: () => void;
}) => (
  <section
    aria-label={SEASON_OVER}
    className="pointer-events-auto fixed inset-0 z-50 flex flex-col items-center gap-2.5 overflow-y-auto bg-kit-ground px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] font-sans text-kit-cream"
  >
    <header className="flex flex-col items-center gap-1">
      <h2 className="frontier-title !text-[26px]">{SEASON_OVER}</h2>
      <p className="text-[15px] font-semibold">{SEASON_ENDINGS[ending]}</p>
      {place !== undefined && <p className="text-[13px] text-kit-muted">{YOU_PLACED}</p>}
    </header>
    {place !== undefined && (
      <p className="flex items-center gap-2.5 tabular-nums">
        <KitIcon code="Tp" size={34} />
        <span className="text-[44px] font-bold leading-none">#{formatAmount(place)}</span>
        <span className="text-[16px] text-kit-muted">/ {formatAmount(field)}</span>
      </p>
    )}
    <Podium podium={podium} />
    {totals && (
      <div className="w-full max-w-[360px]">
        <TotalsGrid
          cells={[
            { icon: "Fl", value: formatAmount(totals.sitesCleared) },
            { icon: "Ch", value: formatAmount(totals.chests) },
            { icon: "Lo", value: formatAmount(totals.lords) },
            { icon: "Dp", value: REACH_NUMERALS[totals.reach - 1] ?? "—" },
            { icon: "Es", value: formatAmount(totals.essence) },
            { icon: "La", value: formatAmount(totals.labor) },
          ]}
        />
      </div>
    )}
    <div className="min-h-2 flex-1" />
    <div className="flex w-full max-w-[360px] gap-2">
      <Button role="secondary" icon="Tp" word={SEASON} onClick={onSeason} className="w-[130px]" />
      <Button role="primary" icon="Hm" word={EXIT} onClick={onExit} className="flex-1" />
    </div>
  </section>
);

/** Second, first and third, the first raised. */
const PODIUM_ORDER = [1, 0, 2] as const;

const Podium = ({ podium }: { podium: readonly PodiumPlace[] }) => (
  <ol className="frontier-card flex w-full max-w-[360px] items-end gap-1.5 !rounded-xl p-2">
    {PODIUM_ORDER.map((index) => podium[index]).map(
      (place) =>
        place && (
          <li
            key={place.key}
            className={cn("flex min-w-0 flex-1 flex-col items-center gap-1", place.rank === 1 && "pb-3")}
          >
            <span className="text-[16px] tabular-nums">{place.rank}</span>
            <span className="max-w-full text-[13px]">{place.name}</span>
            <span className="flex items-center gap-1 text-[14px] tabular-nums">
              <KitIcon code="Fl" size={16} />
              {formatAmount(place.sitesCleared)}
            </span>
          </li>
        ),
    )}
  </ol>
);
