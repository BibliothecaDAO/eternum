import { useGame } from "@/hooks/context/game-context";
import { useCurrentArmiesTick, useCurrentDefaultTick, useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useWorldSpatialTiles } from "@/hooks/use-world-spatial-tiles";
import { requireActiveGameClient } from "@/sync/active-game-client";
import { toast } from "@/ui/features/event-feed/notify";
import { extractReadableErrorMessage } from "@/utils/error-message";
import { ResourceManager, spawnRing, structureMapPosition } from "@bibliothecadao/eternum";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { type Direction, getNeighborHexes, RESOURCE_PRECISION } from "@bibliothecadao/types";
import { useMemo, useState } from "react";

import { useExpeditionRules, useGoToFrontierPlace } from "../frontier-home";
import { secondsUntilHeld } from "../hud/army-order";
import { dayClock } from "../hud/day-clock";
import { armyArt } from "../hud/dock-armies";
import { deployArmy, deployDirection, deployRange, previewDeploy, readDeployPlan } from "./deploy-plan";
import { DeployView } from "./deploy-view";

const DEPLOY_MODELS = ["ArmySlot", "ResourceBalance", "ResourceProduction", "Structure", "TileOccupancy"] as const;

/** Deploy over the game's facts: the realm's plan, the count the player drags, the tile, and the Deploy command. */
export const DeploySheet = ({ realm, onClose }: { realm: NativeRows["Structure"]; onClose: () => void }) => {
  const { setup } = useGame();
  const defaultTick = useCurrentDefaultTick();
  const armiesTick = useCurrentArmiesTick();
  const revision = useNativeRevision(DEPLOY_MODELS);
  const plan = useMemo(
    () => readDeployPlan(setup.store, realm, defaultTick),
    [defaultTick, realm, revision, setup.store],
  );
  const range = plan ? deployRange(plan) : { troopsMax: 0, wheatMax: 0, max: 0 };
  const [count, setCount] = useState<number | null>(null);
  // The sheet opens at the most the realm can field; a count being dragged survives fact revisions.
  const shown = Math.min(count ?? range.max, range.max);
  const preview = plan ? previewDeploy(setup.store, realm.game_id, plan, shown, armiesTick) : null;
  const ring = useDeployRing(realm);
  const [picked, setPicked] = useState<Direction | null>(null);
  const direction = deployDirection(ring, picked);
  const [sending, setSending] = useState(false);
  const rules = useExpeditionRules();
  const clock = rules ? dayClock(rules, useNowSeconds()) : undefined;
  const goToPlace = useGoToFrontierPlace(realm);
  const wheatPerHour = new ResourceManager(setup.store, realm.entity_id).wheatPerHour(defaultTick);

  const deploy = async () => {
    if (!plan?.troops || direction === null || !preview) return;
    setSending(true);
    try {
      await deployArmy(requireActiveGameClient().actions, realm, plan.troops, preview.count, direction);
      onClose();
    } catch (error) {
      toast.error(extractReadableErrorMessage(error, "The army could not deploy."));
    } finally {
      setSending(false);
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
      revealYield={
        preview?.revealYield === undefined ? undefined : Number(preview.revealYield / BigInt(RESOURCE_PRECISION))
      }
      startingStamina={preview?.stamina?.amount}
      clock={clock}
      ring={plan?.next ? { tiles: ring, chosen: direction, onPick: setPicked } : undefined}
      canDeploy={Boolean(plan?.troops && preview && preview.count > 0 && direction !== null && plan.next)}
      sending={sending}
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
