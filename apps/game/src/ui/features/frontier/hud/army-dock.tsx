import { useSelectArmyOnMap } from "@/hooks/helpers/use-navigate";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useInFlight } from "@/hooks/store/use-actions-in-flight";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useLayout } from "@/shell/frame/layout";
import { canIssueOrders } from "@/utils/can-issue-orders";
import { openArmyDeployment } from "@/ui/features/military/utils/open-army-deployment";
import { safeInteger, type NativeRows } from "@bibliothecadao/eternum/game-client";
import { DEPLOY, DEPLOY_FILLS_FIRST, DEPLOYING } from "@/ui/design-system/kit/words";

import { attributeBadgeTarget } from "../attributes/attributes";
import type { SlotStart } from "../deploy/deploy-plan";
import { slotStartLine } from "../deploy/slot-start";
import { useDeployPlan } from "../deploy/use-deploy-plan";
import { useWellRefill } from "../sites/well-refill";
import { ArmyList, ArmyRow } from "./army-row";
import { ArmyToken, OpenSlot } from "./army-token";
import type { DockArmy } from "./dock-armies";

/**
 * Every army slot in order: a phone's dock or a desktop's list, each showing its army or starting stamina. Only the
 * lowest free slot offers Deploy. A visited realm shows its armies read-only, and an empty desktop list stays absent.
 */
export const ArmyDock = ({
  realm,
  armies,
  lastHour = false,
  onOpenArmy,
}: {
  realm: NativeRows["Structure"];
  armies: DockArmy[];
  /** The day's last hour: each army shows what its Homecoming sends home when the day ends. */
  lastHour?: boolean;
  /** An army's panel: its figures, its XP and its level-ups. */
  onOpenArmy?: (explorerId: number) => void;
}) => {
  const ordersAllowed = useUIStore(canIssueOrders);
  const actor = useAccountStore((state) => state.account?.address ?? null);
  // Only the actor's own armies are pan targets: a visited realm's army regions are not streamed.
  const own = actor !== null && BigInt(realm.owner) === BigInt(actor);
  const openSlots = useDeployPlan(realm)?.open;
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
        <Army
          key={entry.army.explorerId}
          army={entry.army}
          returnsHome={lastHour ? entry.army.returnsHome : undefined}
          pickable={own}
          onOpenArmy={own ? onOpenArmy : undefined}
        />
      );
    }
    return (
      <DeploySlot
        key={`slot-${entry.slot.slot}`}
        realm={realm}
        slot={entry.slot}
        first={entry.slot === next}
        waits={entry.slot === next ? undefined : next}
        pulse={entry.slot === next && armies.length === 0}
        wide={desktop}
      />
    );
  });
  const pending =
    openSlots === undefined &&
    Array.from({ length: openCount }, (_, index) => (
      <DeploySlot
        realm={realm}
        slot={undefined}
        key={`open-${index}`}
        first={index === 0}
        pulse={false}
        wide={desktop}
      />
    ));
  if (desktop)
    return (
      <ArmyList used={armies.length} allowed={armies.length + openCount}>
        {entries}
        {pending}
      </ArmyList>
    );
  return (
    <nav aria-label="Armies" className="pointer-events-auto flex gap-1.5">
      {entries}
      {pending}
    </nav>
  );
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
  returnsHome,
  pickable,
  onOpenArmy,
}: {
  army: DockArmy;
  returnsHome: number | undefined;
  pickable: boolean;
  onOpenArmy?: (explorerId: number) => void;
}) => {
  const { selected, stamina, onPick } = useDockArmy(army, pickable, onOpenArmy);
  return (
    <ArmyToken
      label={army.label}
      returnsHome={returnsHome}
      number={army.number}
      art={army.art}
      xp={army.xp}
      xpGoal={army.xpGoal}
      stamina={stamina}
      troops={army.troops}
      canBuyTier={army.canBuyTier}
      selected={selected}
      flyTarget={attributeBadgeTarget(army.explorerId)}
      onPick={onPick}
    />
  );
};

const DockArmyRow = ({
  army,
  returnsHome,
  pickable,
  onOpenArmy,
}: {
  army: DockArmy;
  returnsHome: number | undefined;
  pickable: boolean;
  onOpenArmy?: (explorerId: number) => void;
}) => {
  const { selected, stamina, onPick } = useDockArmy(army, pickable, onOpenArmy);
  return (
    <ArmyRow
      label={army.label}
      returnsHome={returnsHome}
      number={army.number}
      art={army.art}
      troops={army.troops}
      stamina={stamina}
      xp={army.xp}
      xpGoal={army.xpGoal}
      canBuyTier={army.canBuyTier}
      selected={selected}
      flyTarget={attributeBadgeTarget(army.explorerId)}
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
 * Deploy sheet has closed. A desktop's list shows one, the next to fill, as a row.
 */
const DeploySlot = ({
  realm,
  slot,
  first = true,
  waits,
  pulse,
  wide = false,
}: {
  realm: NativeRows["Structure"];
  /** The slot and its start, as the deploy plan reads it; unknown while the plan is. */
  slot: SlotStart | undefined;
  first?: boolean;
  /** The lowest free slot, which Deploy fills before this one. */
  waits?: SlotStart;
  pulse: boolean;
  wide?: boolean;
}) => {
  const deploying = useInFlight("deploy", safeInteger(realm.entity_id)) !== undefined;
  const line = slot && slotStartLine(slot);
  return (
    <OpenSlot
      label={DEPLOY}
      filling={first && deploying ? DEPLOYING : undefined}
      pulse={pulse}
      wide={wide}
      waits={slot && waits ? { number: slot.number, words: DEPLOY_FILLS_FIRST(waits.number) } : undefined}
      start={slot?.start && line ? { bar: slot.start, words: `${line}.` } : undefined}
      onDeploy={() => openArmyDeployment({ structureId: safeInteger(realm.entity_id), isExplorer: true })}
    />
  );
};
