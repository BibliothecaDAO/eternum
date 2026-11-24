import { useSelectArmyOnMap } from "@/hooks/helpers/use-navigate";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useInFlight } from "@/hooks/store/use-actions-in-flight";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useLayout } from "@/shell/frame/layout";
import { canIssueOrders } from "@/utils/can-issue-orders";
import { openArmyDeployment } from "@/ui/features/military/utils/open-army-deployment";
import { safeInteger, type NativeRows } from "@bibliothecadao/eternum/game-client";
import { useNativeFacts } from "@/hooks/helpers/use-native-facts";
import { ARMY_SLOT_WORDS, DEPLOY, DEPLOYING, TROOPS } from "@/ui/design-system/kit/words";

import { formatAmount, frontierTroopName, rankName, TroopTier } from "@bibliothecadao/types";
import type { Rank } from "@/ui/design-system/kit/words";

import type { SlotStart } from "../deploy/deploy-plan";
import { slotStartLine } from "../deploy/slot-start";
import { useDeployPlan } from "../deploy/use-deploy-plan";
import { useWellRefill } from "../sites/well-refill";
import { ArmyCard, ArmySlotsCard, LockedSlotCard, OpenSlotCard } from "./army-row";
import { ArmyToken, OpenSlot } from "./army-token";
import type { DockArmy } from "./dock-armies";

/**
 * Every army slot in order: a phone's dock or a desktop's list, each showing its army or starting stamina. The
 * player can deploy into any free slot. A visited realm shows its armies read-only, and an empty desktop list stays absent.
 */
export const ArmyDock = ({
  realm,
  armies,
  onOpenArmy,
}: {
  realm: NativeRows["Structure"];
  armies: DockArmy[];

  onOpenArmy?: (explorerId: number) => void;
}) => {
  const ordersAllowed = useUIStore(canIssueOrders);
  const actor = useAccountStore((state) => state.account?.address ?? null);
  // Only the actor's own armies are pan targets: a visited realm's army regions are not streamed.
  const own = actor !== null && BigInt(realm.owner) === BigInt(actor);
  const plan = useDeployPlan(realm);
  const openSlots = plan?.open;
  const homeStock =
    plan?.troops && plan.troops.atHome > 0
      ? {
          count: formatAmount(plan.troops.atHome),
          label: `${formatAmount(plan.troops.atHome)} ${frontierTroopName(plan.troops.type) ?? TROOPS}`,
        }
      : undefined;
  const readyAtHome = armies.length === 0 ? homeStock : undefined;
  const limits = useNativeFacts(SLOT_RULE_MODELS).store.get("SliceRules", {
    game_id: realm.game_id,
  })?.troop_limit_config;
  const openCount = ordersAllowed
    ? (openSlots?.length ?? Math.max(0, realm.base.troop_max_explorer_count - armies.length))
    : 0;
  const desktop = useLayout() === "desktop";
  const free = ordersAllowed ? (openSlots ?? []).toSorted((left, right) => left.slot - right.slot) : [];
  const next = free[0];
  const slots = [
    ...armies.map((army) => ({ number: army.number, army })),
    ...free.map((slot) => ({ number: slot.number, slot })),
  ].toSorted((left, right) => left.number - right.number);
  if (desktop && armies.length === 0 && openCount === 0) return null;
  const entries = slots.map((entry) => {
    if ("army" in entry) {
      const Army = desktop ? DockArmyRow : DockToken;
      return (
        <Army key={entry.army.explorerId} army={entry.army} pickable={own} onOpenArmy={own ? onOpenArmy : undefined} />
      );
    }
    return (
      <DeploySlot
        key={`slot-${entry.slot.slot}`}
        realm={realm}
        slot={entry.slot}
        pulse={entry.slot === next && armies.length === 0}
        stock={entry.slot === next ? (desktop ? homeStock : readyAtHome) : undefined}
        primary={entry.slot === next}
        wide={desktop}
      />
    );
  });
  const pending =
    openSlots === undefined &&
    Array.from({ length: openCount }, (_, index) => (
      <DeploySlot realm={realm} slot={undefined} key={`open-${index}`} pulse={false} primary={false} wide={desktop} />
    ));
  if (desktop) {
    const slotRule = limits && readArmySlots(limits, armies.length, realm.base.troop_max_explorer_count);
    return (
      <ArmySlotsCard count={slotRule?.count}>
        {entries}
        {pending}
        {(ordersAllowed ? (slotRule?.locked ?? []) : []).map((slot) => (
          <LockedSlotCard key={`locked-${slot.number}`} number={slot.number} rank={slot.rank} />
        ))}
      </ArmySlotsCard>
    );
  }
  return (
    <nav aria-label="Armies" className="pointer-events-auto flex items-end gap-1.5">
      {entries}
      {pending}
    </nav>
  );
};

const SLOT_RULE_MODELS = ["SliceRules"] as const;

type TroopLimits = NativeRows["SliceRules"]["troop_limit_config"];

const armiesByRank = (limits: TroopLimits): number[] => [
  limits.settlement_armies,
  limits.city_armies,
  limits.kingdom_armies,
  limits.empire_armies,
];

export const readArmySlots = (
  limits: TroopLimits,
  active: number,
  allowed: number,
): { count: string; locked: { number: number; rank: string }[] } => {
  const byRank = armiesByRank(limits);
  const most = Math.max(allowed, ...byRank);
  return {
    count: ARMY_SLOT_WORDS.count(active, allowed, most),
    locked: Array.from({ length: most - allowed }, (_, index) => {
      const number = allowed + index + 1;
      return { number, rank: rankName(byRank.findIndex((armies) => armies >= number)) };
    }),
  };
};

/**
 * Picking an army on the dock or the list, and what it shows: selected, and its stamina as a refill sweeps it. A pick
 * opens the army's panel where the HUD gives the way (useArmyPanelOpens), else selects the army on the map.
 */
const useDockArmy = (army: DockArmy, pickable: boolean, onOpenArmy: ((explorerId: number) => void) | undefined) => {
  const selected = useUIStore((state) => state.entityActions.selectedEntityId === army.explorerId);
  const selectArmy = useSelectArmyOnMap();
  return {
    selected,
    stamina: useWellRefillShown(army),
    onPick: pickable ? () => (onOpenArmy ?? selectArmy)(army.explorerId) : undefined,
  };
};

const DockToken = ({
  army,
  pickable,
  onOpenArmy,
}: {
  army: DockArmy;
  pickable: boolean;
  onOpenArmy?: (explorerId: number) => void;
}) => {
  const { selected, stamina, onPick } = useDockArmy(army, pickable, onOpenArmy);
  return (
    <ArmyToken
      label={army.label}
      drain={army.drain}
      number={army.number}
      art={army.art}
      stamina={stamina}
      troops={army.troops}
      ethereal={army.ethereal}
      selected={selected}
      onPick={onPick}
    />
  );
};

const troopRankOf = (tier: string | undefined): Rank | undefined =>
  tier === TroopTier.T3 ? 3 : tier === TroopTier.T2 ? 2 : tier === TroopTier.T1 ? 1 : undefined;

const DockArmyRow = ({
  army,
  pickable,
  onOpenArmy,
}: {
  army: DockArmy;
  pickable: boolean;
  onOpenArmy?: (explorerId: number) => void;
}) => {
  const { selected, stamina, onPick } = useDockArmy(army, pickable, onOpenArmy);
  const category = army.troopsFact?.category;
  return (
    <ArmyCard
      label={army.label}
      title={(category && frontierTroopName(category)) ?? army.label}
      tier={troopRankOf(army.troopsFact?.tier)}
      drain={army.drain}
      number={army.number}
      art={army.art}
      troops={army.troops}
      stamina={stamina}
      ethereal={army.ethereal}
      selected={selected}
      onPick={onPick}
    />
  );
};

/** A Well's refill sweeps the bar up instead of jumping, from the fact it is given. */
const useWellRefillShown = (army: DockArmy) => {
  const ratio = army.stamina && army.stamina.max > 0 ? army.stamina.current / army.stamina.max : 0;
  const { shown } = useWellRefill(army.explorerId, ratio);
  return army.stamina && { ...army.stamina, current: shown * army.stamina.max };
};

/**
 * An open slot, with the bar it starts its army on; the first one carries the wait of the army being deployed once the
 * Deploy sheet has closed. Each free slot remains available on desktop and phone.
 */
const DeploySlot = ({
  realm,
  slot,
  pulse,
  stock,
  primary,
  wide = false,
}: {
  realm: NativeRows["Structure"];
  /** The slot and its start, as the deploy plan reads it; unknown while the plan is. */
  slot: SlotStart | undefined;
  pulse: boolean;
  stock?: { count: string; label: string };
  primary: boolean;
  wide?: boolean;
}) => {
  const deploying = useInFlight("deploy", safeInteger(realm.entity_id));
  const line = slot && slotStartLine(slot);
  const filling = slot && deploying === slot.slot ? DEPLOYING : undefined;
  const start = slot?.start && line ? { bar: slot.start, words: line } : undefined;
  const onDeploy = () =>
    openArmyDeployment({ structureId: safeInteger(realm.entity_id), isExplorer: true, slot: slot?.slot });
  return wide ? (
    <OpenSlotCard
      number={slot?.number}
      primary={primary}
      filling={filling}
      start={start}
      stock={stock}
      onDeploy={onDeploy}
    />
  ) : (
    <OpenSlot label={DEPLOY} filling={filling} pulse={pulse} tip={start?.words} stock={stock} onDeploy={onDeploy} />
  );
};
