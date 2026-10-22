import { useSelectArmyOnMap } from "@/hooks/helpers/use-navigate";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useInFlight } from "@/hooks/store/use-actions-in-flight";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useLayout } from "@/shell/frame/layout";
import { canIssueOrders } from "@/utils/can-issue-orders";
import { openArmyDeployment } from "@/ui/features/military/utils/open-army-deployment";
import { safeInteger, type NativeRows } from "@bibliothecadao/eternum/game-client";
import { ARMY, DEPLOY, DEPLOYING } from "@/ui/design-system/kit/words";

import { attributeBadgeTarget } from "../attributes/attributes";
import type { SlotStart } from "../deploy/deploy-plan";
import { slotStartWords } from "../deploy/slot-start";
import { useDeployPlan } from "../deploy/use-deploy-plan";
import { useWellRefill } from "../sites/well-refill";
import { ArmyList, ArmyRow } from "./army-row";
import { ArmyToken, OpenSlot } from "./army-token";
import type { DockArmy } from "./dock-armies";

/**
 * The realm's armies today. On a phone, the dock: one row with every slot the castle grants in view, the armies out
 * and then an open slot for each army still to deploy. On a desktop, the list down the left: every slot the castle
 * grants, in slot order (the owner, 22 October: "we should always see all slots"), each with its army or the bar an
 * army deployed into it starts on, Deploy on the lowest open slot, the one the contract fills; the header counts the
 * slots that stand, and nothing shows when there is neither (a realm watched with no army out). A visited realm shows
 * its armies read-only and no Deploy.
 */
export const ArmyDock = ({
  realm,
  armies,
  onOpenArmy,
}: {
  realm: NativeRows["Structure"];
  armies: DockArmy[];
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
  if (desktop && armies.length === 0 && openCount === 0) return null;
  if (desktop)
    return (
      <ArmyList used={armies.length} allowed={armies.length + openCount}>
        {ordersAllowed && openSlots ? (
          everySlot(armies, openSlots).map(({ army, open }) =>
            army ? (
              <DockArmyRow key={army.explorerId} army={army} pickable={own} onOpenArmy={own ? onOpenArmy : undefined} />
            ) : (
              <DeploySlot
                key={`slot-${open!.slot}`}
                realm={realm}
                slot={open}
                next={open === openSlots[0]}
                pulse={armies.length === 0 && open === openSlots[0]}
                wide
              />
            ),
          )
        ) : (
          <>
            {armies.map((army) => (
              <DockArmyRow key={army.explorerId} army={army} pickable={own} onOpenArmy={own ? onOpenArmy : undefined} />
            ))}
            {openCount > 0 && <DeploySlot realm={realm} slot={openSlots?.[0]} pulse={armies.length === 0} wide />}
          </>
        )}
      </ArmyList>
    );
  return (
    <nav aria-label="Armies" className="pointer-events-auto flex gap-1.5">
      {armies.map((army) => (
        <DockToken key={army.explorerId} army={army} pickable={own} onOpenArmy={own ? onOpenArmy : undefined} />
      ))}
      {Array.from({ length: openCount }, (_, index) => (
        <DeploySlot
          realm={realm}
          slot={openSlots?.[index]}
          key={openSlots?.[index]?.slot ?? `open-${index}`}
          first={index === 0}
          pulse={index === 0 && armies.length === 0}
        />
      ))}
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
  pickable,
  onOpenArmy,
}: {
  army: DockArmy;
  pickable: boolean;
  onOpenArmy?: (explorerId: number) => void;
}) => {
  const { selected, stamina, onPick } = useDockArmy(army, pickable, onOpenArmy);
  return (
    <ArmyRow
      label={army.label}
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

/** Every slot the castle grants today, in slot order: the army in it, or the open slot and the bar it starts on. */
const everySlot = (armies: readonly DockArmy[], open: readonly SlotStart[]) =>
  [
    ...armies.map((army) => ({ number: army.number, army, open: undefined })),
    ...open.map((slot) => ({ number: slot.number, army: undefined, open: slot })),
  ].sort((left, right) => left.number - right.number);

/** A Well's refill sweeps the bar up instead of jumping, from the fact it is given. */
const useWellRefillShown = (army: DockArmy) => {
  const ratio = army.stamina && army.stamina.max > 0 ? army.stamina.current / army.stamina.max : 0;
  const { shown } = useWellRefill(army.explorerId, ratio);
  return army.stamina && { current: shown * army.stamina.max, max: army.stamina.max };
};

/**
 * An open slot, with the bar it starts its army on; the first one carries the wait of the army being deployed once the
 * Deploy sheet has closed. On a desktop's list each open slot is a row; only the next to fill opens Deploy, since the
 * contract fills the lowest open slot.
 */
const DeploySlot = ({
  realm,
  slot,
  first = true,
  next = true,
  pulse,
  wide = false,
}: {
  realm: NativeRows["Structure"];
  /** The slot and its start, as the deploy plan reads it; unknown while the plan is. */
  slot: SlotStart | undefined;
  first?: boolean;
  /** Whether Deploy fills this slot next; a later open slot waits, its army's number in its ring. */
  next?: boolean;
  pulse: boolean;
  wide?: boolean;
}) => {
  const deploying = useInFlight("deploy", safeInteger(realm.entity_id)) !== undefined;
  const words = slot && slotStartWords(slot);
  const start = slot?.start && words ? { bar: slot.start, words: `${words.line}. ${words.why}.` } : undefined;
  if (!next && slot)
    return <OpenSlot label={`${ARMY} ${slot.number}`} number={slot.number} pulse={false} wide={wide} start={start} />;
  return (
    <OpenSlot
      label={DEPLOY}
      filling={first && deploying ? DEPLOYING : undefined}
      pulse={pulse}
      wide={wide}
      start={start}
      onDeploy={() => openArmyDeployment({ structureId: safeInteger(realm.entity_id), isExplorer: true })}
    />
  );
};
