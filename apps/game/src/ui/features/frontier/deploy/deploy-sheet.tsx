import { useGame } from "@/hooks/context/game-context";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { useQuery } from "@/hooks/helpers/use-query";
import { sendOnce, useInFlight } from "@/hooks/store/use-actions-in-flight";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { requireActiveGameClient } from "@/sync/active-game-client";
import { showDeployOnMap } from "@/three/scenes/worldmap-deploy-request";
import { toast } from "@/ui/features/event-feed/notify";
import { useDeployRing } from "@/ui/features/military/components/unified-army-creation-modal/use-deploy-ring";
import { type ExpeditionRules, ResourceManager } from "@bibliothecadao/eternum";
import { safeInteger, type NativeRows } from "@bibliothecadao/eternum/game-client";
import type { Direction } from "@bibliothecadao/types";
import { useEffect, useRef, useState } from "react";

import { useGoToFrontierPlace } from "../frontier-home";
import { useRealmStores } from "../realm-stores";
import { secondsUntilHeld } from "../hud/army-order";
import { armyArt } from "../hud/dock-armies";
import { deployArmy, deployDirection, deployRange, previewDeploy } from "./deploy-plan";
import { DeployView } from "./deploy-view";
import { useDeployPlan } from "./use-deploy-plan";

/**
 * Deploy over the game's facts: the realm's plan, the count the player sets, the tile, and the Deploy command. The
 * tile is the deploy order's (openArmyDeployment): the one beside the realm the player held or tapped on the map, else
 * the first open one. While the sheet is open the map shows that order (showDeployOnMap), where a tap on another lit
 * tile orders again; opened anywhere else (the Realm board's dock), the sheet brings the map up.
 */
export const DeploySheet = ({
  realm,
  rules,
  onClose,
}: {
  realm: NativeRows["Structure"];
  rules: ExpeditionRules;
  onClose: () => void;
}) => {
  const { setup } = useGame();
  const defaultTick = useCurrentDefaultTick();
  const plan = useDeployPlan(realm);
  const range = plan ? deployRange(plan) : { troopsMax: 0, wheatMax: 0, max: 0 };
  const [count, setCount] = useState<number | null>(null);
  // The sheet opens at no troops, so +500 gives exactly 500 (owner, 26 October 2026: "it should be 0 so I can press 500
  // and get 500"); Max is one tap away. A count being set survives fact revisions.
  const shown = Math.min(count ?? 0, range.max);
  const preview = plan ? previewDeploy(plan, shown) : null;
  const { center, ring } = useDeployRing(realm);
  const ordered = useUIStore((state) => state.pendingMilitaryAction?.direction ?? null);
  const direction = deployDirection(ring, ordered);
  const realmId = safeInteger(realm.entity_id);
  const goToPlace = useGoToFrontierPlace(realm);
  useMapUnderDeploy(goToPlace);
  useDeployOnMap(realmId, direction);
  const deploying = useInFlight("deploy", realmId) !== undefined;
  const wheatPerHour = new ResourceManager(setup.store, realmId).wheatPerHour(defaultTick);
  const troopsPerHour = useRealmStores(realm, rules)?.troops.perHour;

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
      troopsWait={troopsPerHour ? secondsUntilHeld(0, 1, troopsPerHour) : undefined}
      wheatCost={preview?.wheatCost}
      tile={plan?.next && center ? (direction === null ? "none" : "open") : undefined}
      canDeploy={Boolean(plan?.troops && preview && direction !== null && plan.next)}
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

/** The deploy's tile is picked on the map: a sheet opened off it goes there once, as it opens. */
const useMapUnderDeploy = (goToPlace: (expedition: boolean) => void) => {
  const { isMapView } = useQuery();
  const offMap = useRef(!isMapView);
  useEffect(() => {
    if (!offMap.current) return;
    offMap.current = false;
    goToPlace(true);
  });
};

/** The order shown on the map while the sheet is open, its tile again whenever it changes; none once the sheet closes. */
const useDeployOnMap = (structureId: number, direction: Direction | null) => {
  useEffect(() => {
    showDeployOnMap({ structureId, direction });
  }, [structureId, direction]);
  useEffect(() => {
    return () => showDeployOnMap(null);
  }, []);
};
