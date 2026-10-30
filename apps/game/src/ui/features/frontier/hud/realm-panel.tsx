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
import { REALM, SHOW_MY_REALM } from "@/ui/design-system/kit/words";
import { useLandedValue } from "@/ui/motion/landing-hold";
import { TickNumber } from "@/ui/motion/tick-number";
import type { ReactNode } from "react";

import { RankSteps } from "../realm/rank-steps";
import type { RealmPopulation } from "../realm/realm-population";
import type { CampaignMark } from "../value/campaign-home";
import { RealmsChip } from "../value/lords-purse";
import type { DailyClaimWaiting } from "../value/realm-labor";
import { FRONTIER_STORES } from "../stores";
import { LandingDelta, STORE_TONES, type StoreReading, storeLine } from "./status-strip";

/**
 * Frontier's realm on the desktop HUD's left column, read as Blitz's realm card reads a holding: its name with its
 * rank's steps in a header that takes the map home to it (it never folds), its rank and population (used of all it can
 * hold) with the way to Realms (the labor they hold today on it), then a ring per store (Essence, Labor, Wheat, Troops),
 * each filling toward its limit with the time until full on its rim, and a ring for its LORDS. A tap on a store with a
 * card opens it under the rings, on the LORDS Withdraw; a realm watched or visited shows its stores alone. The day's
 * clock is the top bar's.
 */
export const RealmPanel = ({
  name,
  level,
  highest,
  population,
  stores,
  lords,
  waiting = null,
  onHome,
  storeCards,
  onWithdraw,
  onRealms,
  mark,
}: {
  name: string;
  level: number | undefined;
  /** The highest level a realm reaches: its rank's steps run up to it; unknown leaves them out. */
  highest?: number;
  /** What the realm's buildings take of the population its castle and Huts give; unknown is left out. */
  population?: RealmPopulation;
  stores: StoreReading[];
  /** The realm's LORDS; absent for a realm not the player's. */
  lords?: number;
  /** What the home's daily claim has waiting today, which the Realms chip wears. */
  waiting?: DailyClaimWaiting | null;
  /** The header's press: the map centred on the realm. */
  onHome?: () => void;
  /** The stores whose ring opens their card, the one open, and that card under the rings. */
  storeCards?: {
    kinds: readonly StoreReading["kind"][];
    open: StoreReading["kind"] | null;
    onToggle: (kind: StoreReading["kind"]) => void;
    card: ReactNode;
  };
  onWithdraw?: () => void;
  onRealms?: () => void;
  /** The campaign that founded the home, worn beside its rank by every viewer. */
  mark?: CampaignMark | null;
}) => (
  <HudPanel
    label={REALM}
    title={
      <span className="inline-flex items-center gap-2">
        {name}
        {level !== undefined && highest !== undefined && <RankSteps level={level} highest={highest} />}
      </span>
    }
    icon={onHome ? "location" : undefined}
    onTitle={onHome && { label: SHOW_MY_REALM, run: onHome }}
    collapsible={false}
    className="pointer-events-auto"
    bodyClassName="flex flex-col gap-2"
  >
    {/* Its readings vary in length (a rank's name, a population, the labor waiting): the row wraps rather than run
        past the card, the Realms chip keeping to the right on whichever line it lands. */}
    <div className="flex min-h-9 flex-wrap items-center gap-x-2 gap-y-1 text-hud-strong text-hud-ink">
      {level !== undefined && (
        <span className="flex items-center gap-2">
          {/* A campaign home's pavilion stands for its rank's icon; its campaign's name is the icon's tip. */}
          <SemanticIcon name={mark?.icon ?? realmMeaning(level)} size={24} alt={mark?.line} data-tip={mark?.line} />
          {rankName(level)}
        </span>
      )}
      {population && <PopulationReading population={population} />}
      {onRealms && (
        <span className="ml-auto">
          <RealmsChip waiting={waiting} onOpen={onRealms} />
        </span>
      )}
    </div>
    <ul aria-label="Stores" className="grid grid-cols-5 justify-items-center gap-y-5 pb-2 pt-2">
      {stores.map((store) => (
        <li key={store.kind} className="relative">
          <StoreRing
            store={store}
            onOpen={storeCards?.kinds.includes(store.kind) ? () => storeCards.onToggle(store.kind) : undefined}
          />
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
    {storeCards?.open && storeCards.card}
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
        icon={FRONTIER_STORES[store.kind].icon}
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
