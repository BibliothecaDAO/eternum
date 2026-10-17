import { cn } from "@/ui/design-system/atoms/lib/utils";
import { useSelectArmyOnMap } from "@/hooks/helpers/use-navigate";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useInFlight } from "@/hooks/store/use-actions-in-flight";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useLayout } from "@/shell/frame/layout";
import { canIssueOrders } from "@/utils/can-issue-orders";
import { openArmyDeployment } from "@/ui/features/military/utils/open-army-deployment";
import { Sweep } from "@/ui/motion/sweep";
import { safeInteger, type NativeRows } from "@bibliothecadao/eternum/game-client";
import { DEPLOY, DEPLOYING } from "@/ui/design-system/kit/words";

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
  // Desktop has the width for full cards down the left; a phone keeps one row of tokens.
  const wide = useLayout() === "desktop";
  return (
    <nav aria-label="Armies" className={cn("pointer-events-auto flex gap-1.5", wide && "flex-col")}>
      {armies.map((army, index) => (
        <DockToken key={army.explorerId} army={army} pickable={own} guided={own && index === 0} wide={wide} />
      ))}
      {ordersAllowed &&
        Array.from({ length: openCount }, (_, index) => (
          <DeploySlot
            realm={realm}
            key={openSlots?.[index]?.slot ?? `open-${index}`}
            first={index === 0}
            pulse={index === 0 && armies.length === 0}
            wide={wide}
          />
        ))}
    </nav>
  );
};

const DockToken = ({
  army,
  pickable,
  guided,
  wide,
}: {
  army: DockArmy;
  pickable: boolean;
  guided: boolean;
  wide: boolean;
}) => {
  const selected = useUIStore((state) => state.entityActions.selectedEntityId === army.explorerId);
  const selectArmy = useSelectArmyOnMap();
  const pick = () => selectArmy(army.explorerId);
  const stamina = useWellRefillShown(army);
  return (
    <ArmyToken
      label={army.label}
      number={army.number}
      art={army.art}
      xp={army.xp}
      xpGoal={army.xpGoal}
      tiers={army.tiers}
      stamina={stamina}
      troops={army.troops}
      canBuyTier={army.canBuyTier}
      selected={selected}
      flyTarget={attributeBadgeTarget(army.explorerId)}
      guided={guided}
      wide={wide ? { secondsToFull: army.secondsToFull, returnsHome: army.returnsHome } : undefined}
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

/** An open slot; the first one takes the guide's sweep when it points at Deploy. */
const DeploySlot = ({
  realm,
  first,
  pulse,
  wide,
}: {
  realm: NativeRows["Structure"];
  first: boolean;
  pulse: boolean;
  wide: boolean;
}) => {
  const pointed = useDeployPointed();
  // The army being deployed takes the first open slot: it carries the wait once the Deploy sheet has closed.
  const deploying = useInFlight("deploy", safeInteger(realm.entity_id)) !== undefined;
  return (
    <Sweep play={first ? pointed : 0} className="shrink-0 rounded-xl">
      <OpenSlot
        label={DEPLOY}
        filling={first && deploying ? DEPLOYING : undefined}
        pulse={pulse}
        guided={first}
        wide={wide}
        onDeploy={() => openArmyDeployment({ structureId: safeInteger(realm.entity_id), isExplorer: true })}
      />
    </Sweep>
  );
};
