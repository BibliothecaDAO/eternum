import {
  formatAmount,
  formatExact,
  formatPopulation,
  formatPopulationInWords,
  LORDS,
  rankName,
} from "@bibliothecadao/types";
import { realmMeaning } from "@/ui/design-system/domain-icon-meaning";
import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { HudPanel, HudRing } from "@/ui/design-system/kit/hud-elements";
import { REALM } from "@/ui/design-system/kit/words";
import { useLandedValue } from "@/ui/motion/landing-hold";
import { TickNumber } from "@/ui/motion/tick-number";

import type { RealmPopulation } from "../realm/realm-population";
import { RealmsChip } from "../value/lords-purse";
import { LandingDelta, STORE_TONES, STORES, type StoreReading, storeLine } from "./status-strip";

/**
 * Frontier's realm on the desktop HUD's left column, read as Blitz's realm card reads a holding: its name, its rank
 * and population (used of all it can hold) with the way to Realms (the labor they hold today on it), then a ring per store (Essence, Labor, Wheat, Troops), each filling toward its
 * limit with the time until full on its rim, and a ring for its LORDS. A tap on a store opens Production, on the LORDS
 * Withdraw; a realm watched or visited shows its stores alone. The day's clock is the top bar's.
 */
export const RealmPanel = ({
  name,
  level,
  population,
  stores,
  lords,
  labor = 0,
  onOpenStores,
  onWithdraw,
  onRealms,
}: {
  name: string;
  level: number | undefined;
  /** What the realm's buildings take of the population its castle and Huts give; unknown is left out. */
  population?: RealmPopulation;
  stores: StoreReading[];
  /** The realm's LORDS; absent for a realm not the player's. */
  lords?: number;
  /** The labor the player's Realms have waiting today, which the Realms chip wears. */
  labor?: number;
  onOpenStores?: () => void;
  onWithdraw?: () => void;
  onRealms?: () => void;
}) => (
  <HudPanel label={REALM} title={name} className="pointer-events-auto" bodyClassName="flex flex-col gap-2">
    <div className="flex min-h-9 items-center gap-2 text-hud-strong text-hud-ink">
      {level !== undefined && (
        <>
          <SemanticIcon name={realmMeaning(level)} size={24} />
          {rankName(level)}
        </>
      )}
      {population && <PopulationReading population={population} />}
      <span className="flex-1" />
      {onRealms && <RealmsChip labor={labor} onOpen={onRealms} />}
    </div>
    <ul aria-label="Stores" className="grid grid-cols-5 justify-items-center gap-y-5 pb-2 pt-2">
      {stores.map((store) => (
        <li key={store.kind} className="relative">
          <StoreRing store={store} onOpen={onOpenStores} />
        </li>
      ))}
      {lords !== undefined && (
        <li>
          <HudRing
            icon="lords"
            label={`${LORDS} ${formatExact(lords)}`}
            tip={LORDS}
            foot={formatAmount(lords)}
            onClick={onWithdraw}
          />
        </li>
      )}
    </ul>
  </HudPanel>
);

/** The realm's population as Blitz's realm card reads a holding's: used of all it can hold, the whole line on hover. */
const PopulationReading = ({ population: { used, total } }: { population: RealmPopulation }) => (
  <span className="flex items-center gap-1.5 tabular-nums" data-tip={formatPopulationInWords(used, total)}>
    <SemanticIcon name="people" size={16} />
    {formatPopulation(used, total)}
  </span>
);

/**
 * A store as a ring: its amount on the foot, rolling as it changes and landing a payout's "+N", the share of its limit
 * as the arc, and the time until full on the rim while it fills. Its line is its one name and its hover.
 */
const StoreRing = ({ store, onOpen }: { store: StoreReading; onOpen?: () => void }) => {
  const shown = useLandedValue(store.flyTarget, store.amount);
  const line = storeLine(store);
  return (
    <>
      <LandingDelta target={store.flyTarget} />
      <HudRing
        icon={STORES[store.kind].icon}
        label={line}
        tip={line}
        state={store.perHour === undefined ? undefined : store.perHour > 0 ? "producing" : "idle"}
        progress={store.limit === undefined || store.amount === undefined ? undefined : store.amount / store.limit}
        timeLeft={store.fullIn === undefined || store.fullIn <= 0 ? undefined : store.fullIn}
        foot={
          <span data-fly-target={store.flyTarget} className={`tabular-nums ${STORE_TONES[store.tone].text}`}>
            {shown === undefined ? "—" : <TickNumber value={shown} format={formatAmount} />}
          </span>
        }
        onClick={onOpen}
      />
    </>
  );
};
