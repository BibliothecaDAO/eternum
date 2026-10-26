import { useGame } from "@/hooks/context/game-context";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { sendOnce, useInFlight } from "@/hooks/store/use-actions-in-flight";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { requireActiveGameClient } from "@/sync/active-game-client";
import { showDeployOnMap } from "@/three/scenes/worldmap-deploy-request";
import { toast } from "@/ui/features/event-feed/notify";
import { useDeployRing } from "@/ui/features/military/components/unified-army-creation-modal/use-deploy-ring";
import { ResourceManager } from "@bibliothecadao/eternum";
import { safeInteger, type NativeRows } from "@bibliothecadao/eternum/game-client";
import type { Direction } from "@bibliothecadao/types";
import { useEffect, useState } from "react";

import { useGoToFrontierPlace } from "../frontier-home";
import { secondsUntilHeld } from "../hud/army-order";
import { armyArt } from "../hud/dock-armies";
import { deployArmy, deployDirection, deployRange, previewDeploy } from "./deploy-plan";
import { DeployView } from "./deploy-view";
import { useDeployPlan } from "./use-deploy-plan";

/**
 * Deploy over the game's facts: the realm's plan, the count the player sets, the tile, and the Deploy command. The
 * tile is the deploy order's (openArmyDeployment): the one beside the realm the player held or tapped on the map, else
 * the first open one. While the sheet is open the map shows that order (showDeployOnMap), where a tap on another lit
 * tile orders again.
 */
export const DeploySheet = ({ realm, onClose }: { realm: NativeRows["Structure"]; onClose: () => void }) => {
  const { setup } = useGame();
  const defaultTick = useCurrentDefaultTick();
  const plan = useDeployPlan(realm);
  const range = plan ? deployRange(plan) : { troopsMax: 0, wheatMax: 0, max: 0 };
  const [count, setCount] = useState<number | null>(null);
  // The sheet opens at half of what the realm can field, leaving troops and wheat for the day's other armies; Max is
  // one tap away. A count being set survives fact revisions.
  const shown = Math.min(count ?? Math.ceil(range.max / 2), range.max);
  const preview = plan ? previewDeploy(plan, shown) : null;
  const { center, ring } = useDeployRing(realm);
  const ordered = useUIStore((state) => state.pendingMilitaryAction?.direction ?? null);
  const direction = deployDirection(ring, ordered);
  const realmId = safeInteger(realm.entity_id);
  useDeployOnMap(realmId, direction);
  const deploying = useInFlight("deploy", realmId) !== undefined;
  const goToPlace = useGoToFrontierPlace(realm);
  const wheatPerHour = new ResourceManager(setup.store, realmId).wheatPerHour(defaultTick);

  /** The sheet closes as the army leaves; its slot on the dock carries the wait, and a refusal says why there. */
  const deploy = async () => {
    const troops = plan?.troops;
    if (!troops || direction === null || !preview) return;
    try {
      await sendOnce("deploy", realmId, true, async () => {
        const sent = await deployArmy(requireActiveGameClient().actions, realm, troops, preview.count, direction);
        onClose();
        return sent;
      });
    } catch (error) {
      toast.failed(error, "The army could not deploy.");
    }
  };

  return (
    <DeployView
      art={plan?.troops ? armyArt({ category: plan.troops.type, tier: plan.troops.tier }) : undefined}
      troopsAtHome={plan ? (plan.troops?.atHome ?? 0) : undefined}
      count={preview?.count}
      amount={{ most: range.max, held: range.wheatMax < range.troopsMax ? range.max : (plan?.troops?.atHome ?? 0) }}
      onCount={setCount}
      start={plan?.next ?? undefined}
      wheatCost={preview?.wheatCost}
      march={preview?.tiles}
      tile={plan?.next && center ? (direction === null ? "none" : "open") : undefined}
      canDeploy={Boolean(plan?.troops && preview && preview.count > 0 && direction !== null && plan.next)}
      sending={deploying}
      onDeploy={() => void deploy()}
      wheatShort={
        plan?.troops && range.max === 0
          ? {
              held: plan.wheat,
              need: plan.wheatPerTroop,
              wait: secondsUntilHeld(plan.wheat, plan.wheatPerTroop, wheatPerHour),
            }
          : undefined
      }
      onBuild={() => {
        onClose();
        goToPlace(false);
      }}
      onClose={onClose}
    />
  );
};

/** The order shown on the map while the sheet is open, its tile again whenever it changes; none once the sheet closes. */
const useDeployOnMap = (structureId: number, direction: Direction | null) => {
  useEffect(() => showDeployOnMap({ structureId, direction }), [structureId, direction]);
  useEffect(() => () => showDeployOnMap(null), []);
};
