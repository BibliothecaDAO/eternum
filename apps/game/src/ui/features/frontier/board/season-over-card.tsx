import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { formatAmount } from "@/ui/design-system/kit/amount";
import { HudButton, HudPanel } from "@/ui/design-system/kit/hud-elements";

import {
  CHESTS,
  ESSENCE,
  EXIT,
  LABOR,
  LORDS,
  REACH,
  REACH_NUMERALS,
  SEASON,
  SEASON_ENDINGS,
  SEASON_OVER,
  SITES_CLEARED,
  YOU_PLACED,
} from "@/ui/design-system/kit/words";
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
 * the field; then the podium, the player's season in totals, the LORDS still to withdraw from the realm, and Exit with
 * Season beside it. A player without a place (a spectator) sees the ending and the podium.
 */
export const SeasonOverCard = ({
  ending,
  place,
  field,
  podium,
  totals,
  withdraw,
  guide,
  onSeason,
  onExit,
}: {
  ending: keyof typeof SEASON_ENDINGS;
  place: number | undefined;
  field: number | undefined;
  podium: readonly PodiumPlace[];
  totals: SeasonTotals | undefined;
  /** The realm's LORDS still to withdraw: this card covers the HUD, so the way out for them is here. */
  withdraw?: ReactNode;
  /** The guide's line on the season's end. */
  guide?: ReactNode;
  onSeason: () => void;
  onExit: () => void;
}) => (
  <section
    aria-label={SEASON_OVER}
    className="ui pointer-events-auto fixed inset-0 z-50 flex flex-col items-center gap-2.5 overflow-y-auto bg-hud-surface px-4 text-hud-ink"
    style={SAFE_AREA}
  >
    <header className="flex flex-col items-center gap-1">
      <h2 className="text-hud-display text-hud-accent">{SEASON_OVER}</h2>
      <p className="text-hud-strong">{SEASON_ENDINGS[ending]}</p>
      {place !== undefined && <p className="text-hud-body text-hud-muted">{YOU_PLACED}</p>}
    </header>
    {place !== undefined && (
      <p className="flex items-center gap-2.5 tabular-nums">
        <SemanticIcon name="victory" size={34} />
        <span className="text-hud-display text-hud-gold">#{formatAmount(place)}</span>
        <span className="text-hud-body text-hud-muted">/ {formatAmount(field)}</span>
      </p>
    )}
    <Podium podium={podium} />
    {totals && (
      <div className="w-full max-w-sm">
        <TotalsGrid
          cells={[
            { icon: "flag", name: SITES_CLEARED, value: formatAmount(totals.sitesCleared) },
            { icon: "chest", name: CHESTS, value: formatAmount(totals.chests) },
            { icon: "lords", name: LORDS, value: formatAmount(totals.lords) },
            { icon: "portal", name: REACH, value: REACH_NUMERALS[totals.reach - 1] ?? "—" },
            { icon: "essence", name: ESSENCE, value: formatAmount(totals.essence) },
            { icon: "labor", name: LABOR, value: formatAmount(totals.labor) },
          ]}
        />
      </div>
    )}
    <div className="min-h-2 flex-1" />
    <div className="w-full max-w-sm">{withdraw}</div>
    <div className="w-full max-w-sm">{guide}</div>
    {/* Season beside, Exit the one verb, last and widest. */}
    <div className="grid w-full max-w-sm grid-cols-3 gap-2">
      <HudButton kind="secondary" icon="victory" onClick={onSeason}>
        {SEASON}
      </HudButton>
      <span className="col-span-2 grid">
        <HudButton kind="primary" icon="exit" onClick={onExit}>
          {EXIT}
        </HudButton>
      </span>
    </div>
  </section>
);

/** The card covers the screen: its edges keep clear of a phone's notch and home bar. */
const SAFE_AREA = {
  paddingTop: "max(1.5rem, env(safe-area-inset-top))",
  paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
} as const;

/** Second, first and third, the first raised. */
const PODIUM_ORDER = [1, 0, 2] as const;

const Podium = ({ podium }: { podium: readonly PodiumPlace[] }) => (
  <HudPanel collapsible={false} className="w-full max-w-sm">
    <ol className="flex items-end gap-1.5">
      {PODIUM_ORDER.map((index) => podium[index]).map(
        (place) =>
          place && (
            <li
              key={place.key}
              className={cn("flex min-w-0 flex-1 flex-col items-center gap-1", place.rank === 1 && "pb-3")}
            >
              <span className="text-hud-strong tabular-nums">{place.rank}</span>
              <span className="max-w-full text-hud-body">{place.name}</span>
              <span className="flex items-center gap-1 text-hud-body tabular-nums">
                <SemanticIcon name="flag" size={16} />
                {formatAmount(place.sitesCleared)}
              </span>
            </li>
          ),
      )}
    </ol>
  </HudPanel>
);
