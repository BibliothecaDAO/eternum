import { type OpenArmySlot, resolveExplorerTroops } from "@bibliothecadao/eternum/troop-stamina";
import { useGame } from "@/hooks/context/game-context";
import { useBlockTimestamp, useCurrentArmiesTick, useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useNavigateToMapView } from "@/hooks/helpers/use-navigate";
import { useQuery } from "@/hooks/helpers/use-query";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { canIssueOrders } from "@/utils/can-issue-orders";
import { buildStaminaDisplayModel } from "@/lib/army-stamina/presentation";
import type { ArmyStaminaPresentation } from "@/lib/army-stamina/types";
import { getExplorerStaminaSnapshot } from "@/utils/explorer-stamina";
import { requestArmySelection } from "@/three/scenes/worldmap-army-select-request";
import { LeftView } from "@/types";
import { Hourglass } from "@/ui/design-system/atoms/game-icons";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { OVERLAY_SURFACE_ACTIVE, OVERLAY_SURFACE_BASE } from "@/ui/design-system/atoms/overlay-surface";
import {
  configManager,
  entityMapPosition,
  expeditionDepth,
  getArmyName,
  liveHomeArmies,
  Position,
  realmSupportPercent,
} from "@bibliothecadao/eternum";
import type { NativeFactStore, NativeRows } from "@bibliothecadao/eternum/game-client";
import { RESOURCE_PRECISION, type TroopTier, type TroopType } from "@bibliothecadao/types";
import { useMemo } from "react";
import { Sweep } from "@/ui/motion/sweep";
import { Chip, TroopChip, YieldChip } from "./frontier-chips";
import { formatShortClock } from "./frontier-format";
import { PlusGlyph, SlotBanner } from "./glyphs";
import { useExpeditionRules } from "./frontier-home";
import { describeSlotBar, useOpenArmySlots } from "./frontier-muster-stamina";
import { ArmyPortrait } from "./attributes/army-portrait";
import { PickChip } from "./attributes/pick-chip";
import { ATTRIBUTE_LOOK } from "./attributes/attributes";
import { useRevealYield } from "./frontier-reveal-yield";
import { useWellRefill } from "./sites/well-refill";
import { useReducedMotion } from "@/ui/motion/motion-settings";
import { useMusterPointed } from "./guide/guide-pointer";

const ARMY_MODELS = [
  "ArmySlot",
  "ArmyProgress",
  "ArmyProgressionRules",
  "ExplorerTroops",
  "TileOccupancy",
  "EntityName",
] as const;

/**
 * The realm's Support boost today, then one card per army slot the castle grants: today's armies with their troops
 * and stamina, then a Muster card for every open slot, saying whether its next army starts fresh or on the bar a lost
 * army left. A row along the foot of a phone held upright; a column down the left edge otherwise.
 */
export const FrontierArmyDock = ({ realm }: { realm: NativeRows["Structure"] }) => {
  const { setup } = useGame();
  const revision = useNativeRevision(ARMY_MODELS);
  const tick = useCurrentArmiesTick();
  const armies = useMemo(
    () => liveHomeArmies(setup.store, realm.entity_id, configManager.getActiveGameId()),
    [realm.entity_id, revision, setup.store, tick],
  );
  const ordersAllowed = useUIStore(canIssueOrders);
  // Only the actor's own armies are pan targets: a visited realm's army regions are not streamed, so its tile would
  // stand alone in the void.
  const actor = useAccountStore((state) => state.account?.address ?? null);
  const ownArmies = actor !== null && BigInt(realm.owner) === BigInt(actor);
  const openSlots = useOpenArmySlots(realm);
  // Until every slot is known, the castle's allowance still says how many cards are open; their bars read "—".
  const openCards =
    openSlots ??
    Array.from({ length: Math.max(0, realm.base.troop_max_explorer_count - armies.length) }, () => undefined);

  return (
    <nav
      aria-label="Armies"
      className="pointer-events-auto flex gap-2 overflow-x-auto overscroll-contain landscape:flex-col landscape:overflow-y-auto landscape:overflow-x-hidden"
    >
      <SupportToday realm={realm} />
      {armies.map((army, index) => (
        <ArmyCard key={army.explorer_id} army={army} position={index + 1} pannable={ownArmies} />
      ))}
      {/* Mustering is an order: a realm the player does not own, as on a visit, shows only its armies. */}
      {ordersAllowed && openCards.map((slot, index) => <MusterCard key={slot?.slot ?? `open-${index}`} slot={slot} />)}
    </nav>
  );
};

const CARD = "flex w-44 shrink-0 flex-col gap-2 rounded-2xl p-2.5 text-left landscape:w-48";

/**
 * One army as mockup 7 draws it: its portrait (XP ring and level), its troops and tier, its stamina bar, the time to
 * a full bar while it fills, and what its next reveal sends home. Its name is its label for assistive tech only. A
 * visited realm's army is shown, never picked: it is no pan target and carries no pick.
 */
const ArmyCard = ({
  army,
  position,
  pannable,
}: {
  army: NativeRows["ExplorerTroops"];
  position: number;
  pannable: boolean;
}) => {
  const { setup } = useGame();
  const { isMapView } = useQuery();
  const navigateToMapView = useNavigateToMapView();
  const selected = useUIStore((state) => state.entityActions.selectedEntityId === army.explorer_id);
  const { currentArmiesTick, armiesTickTimeRemaining } = useBlockTimestamp();
  const snapshot = getExplorerStaminaSnapshot({
    entityId: army.explorer_id,
    currentArmiesTick,
    liveTroops: resolveExplorerTroops(setup.store, army),
  });
  const stamina = snapshot
    ? buildStaminaDisplayModel({
        committedCurrent: snapshot.current,
        committedMax: snapshot.max,
        armiesTickTimeRemaining,
        currentArmiesTick,
        troops: snapshot.troops,
      })
    : null;

  // The world map selects the army in place; from the realm board the first tap goes out to it.
  const pick = () => {
    if (isMapView) {
      requestArmySelection(army.explorer_id);
      return;
    }
    const coord = entityMapPosition(setup.store, configManager.getActiveGameId(), army.explorer_id);
    navigateToMapView(Position.fromContract(coord));
  };

  // Progress and its rules are required facts: until both arrive the portrait shows no level and no pick waits.
  const progress = setup.store.get("ArmyProgress", { game_id: army.game_id, explorer_id: army.explorer_id });
  const rules = setup.store.get("ArmyProgressionRules", { game_id: army.game_id });
  const name = dockArmyName(setup.store, army.explorer_id, position);

  const card = (
    <>
      <span className="flex items-center gap-2">
        <ArmyPortrait explorerId={army.explorer_id} troops={army.troops} progress={progress} rules={rules} />
        <TroopChip
          small
          type={army.troops.category as TroopType}
          tier={army.troops.tier as TroopTier}
          count={Number(army.troops.count / BigInt(RESOURCE_PRECISION))}
        />
      </span>
      <StaminaBar explorerId={army.explorer_id} stamina={stamina} />
      <span className="flex flex-wrap items-center gap-1.5">
        {stamina && stamina.secondsUntilFull > 0 && (
          <Chip small label="Full in" icon={<Hourglass />} value={formatShortClock(stamina.secondsUntilFull)} />
        )}
        <ArmyRevealYield army={army} />
      </span>
    </>
  );
  if (!pannable)
    return (
      <div role="group" aria-label={name} className={cn(OVERLAY_SURFACE_BASE, CARD)}>
        {card}
      </div>
    );

  // The pick is its own button, so it sits in the card's corner rather than inside the card's button; the dock
  // scrolls, so the corner stays inside the card's bounds.
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        aria-label={name}
        aria-pressed={selected}
        onClick={pick}
        className={cn(OVERLAY_SURFACE_BASE, CARD, selected && OVERLAY_SURFACE_ACTIVE)}
      >
        {card}
      </button>
      {progress && rules && (
        <span className="absolute -right-1 -top-1">
          <PickChip progress={progress} rules={rules} />
        </span>
      )}
    </div>
  );
};

/**
 * The realm's Support boost today, at the head of the dock: its glyph and "+N%" of production, from the day's earned
 * maximum. "—" while unknown; nothing on a day that earned none.
 */
const SupportToday = ({ realm }: { realm: NativeRows["Structure"] }) => {
  const { setup } = useGame();
  const now = useNowSeconds();
  useNativeRevision(SUPPORT_MODELS);
  const percent = realmSupportPercent(setup.store, realm.game_id, realm.entity_id, now);
  if (percent.known === 0) return null;
  return (
    <span className="flex shrink-0 items-center self-center landscape:self-start">
      <Chip
        small
        tone="gain"
        label="Support today"
        icon={<img src={ATTRIBUTE_LOOK.Support.glyph} alt="" />}
        value={percent.known === undefined ? "—" : `+${percent.known}%`}
      />
    </span>
  );
};

const SUPPORT_MODELS = ["RealmSupport", "SliceRules"] as const;

/** What this army's next reveal sends home at the depth it stands on. */
const ArmyRevealYield = ({ army }: { army: NativeRows["ExplorerTroops"] }) => {
  const { setup } = useGame();
  const rules = useExpeditionRules();
  const coord = entityMapPosition(setup.store, configManager.getActiveGameId(), army.explorer_id);
  const amount = useRevealYield(army.troops, rules ? expeditionDepth(rules, coord) : 0);
  if (amount === null) return null;
  return <YieldChip small scaled={amount} />;
};

/**
 * The army's stamina as a bar alone, in the stamina green; its numbers are the bar's label. Unknown is an empty bar.
 * A Well's refill sweeps the fill up and lights the bar.
 */
const StaminaBar = ({ explorerId, stamina }: { explorerId: number; stamina: ArmyStaminaPresentation | null }) => {
  const { refilling, shown } = useWellRefill(explorerId, stamina?.committedRatio ?? 0);
  const reduced = useReducedMotion();
  return (
    <span
      role="meter"
      aria-label={stamina ? `Stamina ${stamina.committedCurrent} of ${stamina.committedMax}` : "Stamina unknown"}
      aria-valuenow={stamina?.committedCurrent}
      aria-valuemax={stamina?.committedMax}
      title={stamina ? `${stamina.committedCurrent}/${stamina.committedMax}` : undefined}
      data-refilling={refilling || undefined}
      className={cn(
        "h-2 overflow-hidden rounded-full bg-black/50 transition-shadow duration-300",
        refilling && "shadow-[0_0_12px_rgba(159,208,106,0.85)]",
      )}
    >
      <span
        className={cn(
          "block h-full rounded-full bg-[#9fd06a]",
          refilling && !reduced && "transition-[width] duration-[900ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]",
          refilling && "bg-[#c6f09a]",
        )}
        style={{ width: `${shown * 100}%` }}
      />
    </span>
  );
};

/** The army's own name when it has one; otherwise its place in the dock, never its entity id. */
const dockArmyName = (store: NativeFactStore, explorerId: number, position: number): string => {
  const named = store.get("EntityName", { game_id: configManager.getActiveGameId(), entity_id: explorerId });
  return named && named.name !== 0n ? getArmyName(explorerId, store) : `Army ${position}`;
};

/** An open slot: an outline banner with a plus, dim when its last army left the slot tired. */
const MusterCard = ({ slot }: { slot: OpenArmySlot | undefined }) => {
  const setLeftNavigationView = useUIStore((state) => state.setLeftNavigationView);
  const pointed = useMusterPointed();
  return (
    <Sweep play={pointed} className="shrink-0 rounded-2xl">
      <button
        type="button"
        aria-label={`Muster, ${describeSlotBar(slot)}`}
        onClick={() => setLeftNavigationView(LeftView.MilitaryView)}
        className={cn(OVERLAY_SURFACE_BASE, CARD, "h-full min-h-28 items-center justify-center border-dashed")}
      >
        <span className={cn("relative", slot?.inherited && "opacity-60")}>
          <SlotBanner used={false} />
          <PlusGlyph className="absolute inset-x-0 top-1 mx-auto size-4" />
        </span>
      </button>
    </Sweep>
  );
};
