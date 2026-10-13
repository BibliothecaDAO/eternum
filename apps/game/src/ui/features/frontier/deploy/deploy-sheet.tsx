import { useGame } from "@/hooks/context/game-context";
import { useCurrentDefaultTick, useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { sendOnce, useInFlight } from "@/hooks/store/use-actions-in-flight";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useWorldSpatialTiles } from "@/hooks/use-world-spatial-tiles";
import { requireActiveGameClient } from "@/sync/active-game-client";
import { toast } from "@/ui/features/event-feed/notify";
import { openArmyDeployment } from "@/ui/features/military/utils/open-army-deployment";
import { extractReadableErrorMessage } from "@/utils/error-message";
import { ResourceManager, spawnRing, structureMapPosition } from "@bibliothecadao/eternum";
import { safeInteger, type NativeRows } from "@bibliothecadao/eternum/game-client";
import { type Direction, getNeighborHexes, RESOURCE_PRECISION } from "@bibliothecadao/types";
import { useMemo, useState } from "react";

import { useExpeditionRules, useGoToFrontierPlace } from "../frontier-home";
import { secondsUntilHeld } from "../hud/army-order";
import { dayClock } from "../hud/day-clock";
import { armyArt } from "../hud/dock-armies";
import { deployArmy, deployDirection, deployRange, previewDeploy, readDeployPlan } from "./deploy-plan";
import { DeployView } from "./deploy-view";

// The training rows set a new army's tiers and its starting bar; ended armies send Homecoming's troops back.
const DEPLOY_MODELS = [
  "ArmyProgress",
  "ArmySlot",
  "ExplorerTroops",
  "RealmKnowledge",
  "ResourceBalance",
  "ResourceProduction",
  "Structure",
  "TileOccupancy",
] as const;

/**
 * Deploy over the game's facts: the realm's plan, the count the player drags, the tile, and the Deploy command. The
 * tile is the deploy order's (openArmyDeployment): the one beside the realm the player ordered on the map, or the one
 * picked on the sheet's ring, which orders again.
 */
export const DeploySheet = ({ realm, onClose }: { realm: NativeRows["Structure"]; onClose: () => void }) => {
  const { setup } = useGame();
  const defaultTick = useCurrentDefaultTick();
  const revision = useNativeRevision(DEPLOY_MODELS);
  const rules = useExpeditionRules();
  const now = useNowSeconds();
  const plan = useMemo(
    () => (rules ? readDeployPlan(setup.store, realm, rules, { now, defaultTick }) : undefined),
    [defaultTick, now, realm, revision, rules, setup.store],
  );
  const range = plan ? deployRange(plan) : { troopsMax: 0, wheatMax: 0, max: 0 };
  const [count, setCount] = useState<number | null>(null);
  // The sheet opens at half of what the realm can field, leaving troops and wheat for the day's other armies; Maximum
  // is one tap away. A count being dragged survives fact revisions.
  const shown = Math.min(count ?? Math.ceil(range.max / 2), range.max);
  const preview = plan ? previewDeploy(setup.store, realm.game_id, plan, shown, defaultTick) : null;
  const ring = useDeployRing(realm);
  const ordered = useUIStore((state) => state.pendingMilitaryAction?.direction ?? null);
  const direction = deployDirection(ring, ordered);
  const orderToward = (toward: Direction) =>
    openArmyDeployment({ structureId: safeInteger(realm.entity_id), isExplorer: true, direction: toward });
  const realmId = safeInteger(realm.entity_id);
  const deploying = useInFlight("deploy", realmId) !== undefined;
  const clock = rules ? dayClock(rules, now) : undefined;
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
      toast.error(extractReadableErrorMessage(error, "The army could not deploy."));
    }
  };

  return (
    <DeployView
      slots={plan?.slots}
      art={plan?.troops ? armyArt({ category: plan.troops.type, tier: plan.troops.tier }) : undefined}
      troopsAtHome={plan ? (plan.troops?.atHome ?? 0) : undefined}
      count={preview?.count}
      troopsMax={range.troopsMax}
      wheatStop={range.wheatMax < range.troopsMax ? range.wheatMax : undefined}
      onCount={setCount}
      equation={preview && { wheatCost: preview.wheatCost, wheatLeft: preview.wheatLeft, tiles: preview.tiles }}
      rations={plan?.rations ?? false}
      startingTiers={plan?.startingTiers}
      revealYield={
        preview?.revealYield === undefined ? undefined : Number(preview.revealYield / BigInt(RESOURCE_PRECISION))
      }
      startingStamina={preview?.stamina?.amount}
      clock={clock}
      ring={plan?.next ? { tiles: ring, chosen: direction, onPick: orderToward } : undefined}
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

/** The six tiles around the realm, each open when the map shows it explored and free (spawnRing). */
const useDeployRing = (realm: NativeRows["Structure"]) => {
  const { setup } = useGame();
  const home = structureMapPosition(setup.store, realm);
  const neighbors = useMemo(() => (home ? getNeighborHexes(home.x, home.y) : []), [home?.x, home?.y]);
  const tiles = useWorldSpatialTiles(neighbors);
  return spawnRing(setup.store, realm, (hex) => {
    const tile = tiles.find(({ hexCoords }) => hexCoords.col === hex.col && hexCoords.row === hex.row);
    return tile ? Number(tile.occupierId) : undefined;
  });
};
