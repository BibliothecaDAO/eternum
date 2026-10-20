import { useSelectArmyOnMap } from "@/hooks/helpers/use-navigate";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useInFlight } from "@/hooks/store/use-actions-in-flight";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useLayout } from "@/shell/frame/layout";
import { canIssueOrders } from "@/utils/can-issue-orders";
import { openArmyDeployment } from "@/ui/features/military/utils/open-army-deployment";
import { safeInteger, type NativeRows } from "@bibliothecadao/eternum/game-client";
import { DEPLOY, DEPLOYING } from "@/ui/design-system/kit/words";

import { attributeBadgeTarget } from "../attributes/attributes";
import { useOpenArmySlots } from "../deploy/open-slots";
import { useWellRefill } from "../sites/well-refill";
import { ArmyList, ArmyRow } from "./army-row";
import { ArmyToken, OpenSlot } from "./army-token";
import type { DockArmy } from "./dock-armies";

/**
 * The realm's armies today. On a phone, the dock: one row with every slot the castle grants in view, the armies out
 * and then an open slot for each army still to deploy. On a desktop, the list down the left: a row each, then one
 * Deploy while a slot is open, the header counting the slots that stand, and nothing when there is neither (a realm
 * watched with no army out). A visited realm shows its armies read-only and no Deploy.
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
  const openSlots = useOpenArmySlots(realm);
  const openCount = ordersAllowed
    ? (openSlots?.length ?? Math.max(0, realm.base.troop_max_explorer_count - armies.length))
    : 0;
  const desktop = useLayout() === "desktop";
  if (desktop && armies.length === 0 && openCount === 0) return null;
  if (desktop)
    return (
      <ArmyList used={armies.length} allowed={armies.length + openCount}>
        {armies.map((army) => (
          <DockArmyRow key={army.explorerId} army={army} pickable={own} onOpenArmy={own ? onOpenArmy : undefined} />
        ))}
        {openCount > 0 && <DeploySlot realm={realm} pulse={armies.length === 0} wide />}
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
 * selects the army on the map and opens its panel (its figures, its XP and its level-ups), even when it was selected.
 */
const useDockArmy = (army: DockArmy, pickable: boolean, onOpenArmy: ((explorerId: number) => void) | undefined) => {
  const selected = useUIStore((state) => state.entityActions.selectedEntityId === army.explorerId);
  const selectArmy = useSelectArmyOnMap();
  return {
    selected,
    stamina: useWellRefillShown(army),
    onPick: pickable
      ? () => {
          selectArmy(army.explorerId);
          onOpenArmy?.(army.explorerId);
        }
      : undefined,
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

/** A Well's refill sweeps the bar up instead of jumping, from the fact it is given. */
const useWellRefillShown = (army: DockArmy) => {
  const ratio = army.stamina && army.stamina.max > 0 ? army.stamina.current / army.stamina.max : 0;
  const { shown } = useWellRefill(army.explorerId, ratio);
  return army.stamina && { current: shown * army.stamina.max, max: army.stamina.max };
};

/**
 * An open slot; the first one carries the wait of the army being deployed once the Deploy sheet has closed. A desktop's
 * list shows one, as a row.
 */
const DeploySlot = ({
  realm,
  first = true,
  pulse,
  wide = false,
}: {
  realm: NativeRows["Structure"];
  first?: boolean;
  pulse: boolean;
  wide?: boolean;
}) => {
  const deploying = useInFlight("deploy", safeInteger(realm.entity_id)) !== undefined;
  return (
    <OpenSlot
      label={DEPLOY}
      filling={first && deploying ? DEPLOYING : undefined}
      pulse={pulse}
      wide={wide}
      onDeploy={() => openArmyDeployment({ structureId: safeInteger(realm.entity_id), isExplorer: true })}
    />
  );
};
