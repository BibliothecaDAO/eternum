import { useGame } from "@/hooks/context/game-context";
import { useNavigateToMapView } from "@/hooks/helpers/use-navigate";
import { useQuery } from "@/hooks/helpers/use-query";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { requestArmySelection } from "@/three/scenes/worldmap-army-select-request";
import { LeftView } from "@/types";
import { canIssueOrders } from "@/utils/can-issue-orders";
import { Sweep } from "@/ui/motion/sweep";
import { configManager, entityMapPosition, Position } from "@bibliothecadao/eternum";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { DEPLOY } from "@/ui/design-system/kit/words";

import { attributeBadgeTarget } from "../attributes/attributes";
import { useOpenArmySlots } from "../deploy/open-slots";
import { useDeployPointed } from "../guide/guide-pointer";
import { useWellRefill } from "../sites/well-refill";
import { ArmyToken, OpenSlot } from "./army-token";
import type { DockArmy } from "./dock-armies";

/**
 * The dock on a phone: one row with every slot the castle grants in view, the armies out today and then an open slot
 * for each army still to deploy. A visited realm shows its armies read-only and no open slot.
 */
export const ArmyDock = ({ realm, armies }: { realm: NativeRows["Structure"]; armies: DockArmy[] }) => {
  const ordersAllowed = useUIStore(canIssueOrders);
  const actor = useAccountStore((state) => state.account?.address ?? null);
  // Only the actor's own armies are pan targets: a visited realm's army regions are not streamed.
  const own = actor !== null && BigInt(realm.owner) === BigInt(actor);
  const openSlots = useOpenArmySlots(realm);
  const openCount = openSlots?.length ?? Math.max(0, realm.base.troop_max_explorer_count - armies.length);
  return (
    <nav aria-label="Armies" className="pointer-events-auto flex gap-1.5">
      {armies.map((army) => (
        <DockToken key={army.explorerId} army={army} pickable={own} />
      ))}
      {ordersAllowed &&
        Array.from({ length: openCount }, (_, index) => (
          <DeploySlot
            key={openSlots?.[index]?.slot ?? `open-${index}`}
            first={index === 0}
            pulse={index === 0 && armies.length === 0}
          />
        ))}
    </nav>
  );
};

const DockToken = ({ army, pickable }: { army: DockArmy; pickable: boolean }) => {
  const selected = useUIStore((state) => state.entityActions.selectedEntityId === army.explorerId);
  const pick = usePickArmy(army.explorerId);
  const stamina = useWellRefillShown(army);
  return (
    <ArmyToken
      label={army.label}
      art={army.art}
      xp={army.xp}
      stamina={stamina}
      troops={army.troops}
      canBuyTier={false}
      selected={selected}
      flyTarget={attributeBadgeTarget(army.explorerId)}
      onPick={pickable ? pick : undefined}
    />
  );
};

/** A Well's refill sweeps the bar up instead of jumping, from the fact it is given. */
const useWellRefillShown = (army: DockArmy) => {
  const ratio = army.stamina && army.stamina.max > 0 ? army.stamina.current / army.stamina.max : 0;
  const { shown } = useWellRefill(army.explorerId, ratio);
  return army.stamina && { current: shown * army.stamina.max, max: army.stamina.max };
};

/** The world map selects the army in place; from the realm board the first tap goes out to it. */
const usePickArmy = (explorerId: number) => {
  const { setup } = useGame();
  const { isMapView } = useQuery();
  const navigateToMapView = useNavigateToMapView();
  return () => {
    if (isMapView) {
      requestArmySelection(explorerId);
      return;
    }
    const coord = entityMapPosition(setup.store, configManager.getActiveGameId(), explorerId);
    navigateToMapView(Position.fromContract(coord));
  };
};

/** An open slot; the first one takes the guide's sweep when it points at Deploy. */
const DeploySlot = ({ first, pulse }: { first: boolean; pulse: boolean }) => {
  const setLeftNavigationView = useUIStore((state) => state.setLeftNavigationView);
  const pointed = useDeployPointed();
  return (
    <Sweep play={first ? pointed : 0} className="shrink-0 rounded-xl">
      <OpenSlot label={DEPLOY} pulse={pulse} onDeploy={() => setLeftNavigationView(LeftView.MilitaryView)} />
    </Sweep>
  );
};
