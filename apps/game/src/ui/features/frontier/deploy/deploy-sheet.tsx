import { useGame } from "@/hooks/context/game-context";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { useQuery } from "@/hooks/helpers/use-query";
import { sendOnce, useInFlight } from "@/hooks/store/use-actions-in-flight";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { requireActiveGameClient } from "@/sync/active-game-client";
import { showDeployOnMap } from "@/three/scenes/worldmap-deploy-request";
import { toast } from "@/ui/features/event-feed/notify";
import { openArmyDeployment } from "@/ui/features/military/utils/open-army-deployment";
import { useDeployRing } from "@/ui/features/military/components/unified-army-creation-modal/use-deploy-ring";
import { type ExpeditionRules, getTroopResourceId, ResourceManager } from "@bibliothecadao/eternum";
import { safeInteger, type NativeRows } from "@bibliothecadao/eternum/game-client";
import { FRONTIER_TROOP_NAMES, TROOP_TYPES, TroopTier, type TroopType, type Direction } from "@bibliothecadao/types";
import { useEffect, useRef, useState } from "react";

import { useGoToFrontierPlace } from "../frontier-home";
import { useRealmStores } from "../realm-stores";
import { madeStoreOf } from "../stores";
import { secondsUntilHeld } from "../hud/army-order";
import { armyArt } from "../hud/dock-armies";
import { deployArmy, deployDirection, deployRange, marchOn, previewDeploy, wheatStopsAt } from "./deploy-plan";
import { useHomeOathSlots } from "../army/oath-slots";
import { DeployView, type DeployTroopChoiceView } from "./deploy-view";
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
  const [troopType, setTroopType] = useState<TroopType>();
  const plan = useDeployPlan(realm, troopType);
  const [count, setCount] = useState<number | "max">("max");
  const { center, ring } = useDeployRing(realm);
  const ordered = useUIStore((state) => state.pendingMilitaryAction?.direction ?? null);
  const direction = deployDirection(ring, ordered);
  const pickedSlot = useUIStore((state) => state.pendingMilitaryAction?.slot);
  const start = pickedSlot === undefined ? plan?.open[0] : plan?.open.find((slot) => slot.slot === pickedSlot);
  const march = start?.start && marchOn(start.start, 0);
  const range = plan ? deployRange(plan, march) : { troopsMax: 0, wheatMax: 0, max: 0 };
  const shown = count === "max" ? range.max : Math.min(count, range.wheatMax);
  const preview = plan ? previewDeploy(plan, march, shown) : null;
  const wheatStop = wheatStopsAt(range, shown);
  const pickSlot = (slot: number) =>
    openArmyDeployment({
      structureId: safeInteger(realm.entity_id),
      isExplorer: true,
      slot,
      direction: direction ?? undefined,
    });
  const realmId = safeInteger(realm.entity_id);
  const goToPlace = useGoToFrontierPlace(realm);
  useMapUnderDeploy(goToPlace);
  useDeployOnMap(realmId, direction);
  const deploying = useInFlight("deploy", realmId) !== undefined;
  const wheatPerHour = new ResourceManager(setup.store, realmId).wheatPerHour(defaultTick);
  const stores = useRealmStores(realm, rules);
  const troopWaits = TROOP_TYPES.flatMap((type) => {
    const kind = madeStoreOf(getTroopResourceId(type, TroopTier.T1));
    const wait = kind ? stores?.[kind].nextIn : undefined;
    return wait === undefined ? [] : [wait];
  });
  const nextTroopIn = troopWaits.length ? Math.min(...troopWaits) : undefined;
  const oathSlots = useHomeOathSlots(plan?.troops?.type, realmId);

  /** The sheet closes as the army leaves; its slot on the dock carries the wait, and a refusal says why there. */
  const deploy = async () => {
    const troops = plan?.troops;
    if (!troops || direction === null || !preview || !start) return;
    try {
      await sendOnce("deploy", realmId, start.slot, async () => {
        const sent = await deployArmy(
          requireActiveGameClient().actions,
          realm,
          troops,
          preview.count,
          direction,
          start.slot,
        );
        onClose();
        return sent;
      });
    } catch (error) {
      toast.failed(error, "The army could not deploy.");
    }
  };

  const troopChoices: DeployTroopChoiceView[] =
    plan?.choices.map((troops) => {
      return {
        category: troops.type,
        name: FRONTIER_TROOP_NAMES[troops.type],
        art: armyArt({ category: troops.type, tier: troops.tier }),
        atHome: troops.atHome,
      };
    }) ?? [];

  return (
    <DeployView
      oathSlots={oathSlots}
      troopSelection={{
        choices: troopChoices,
        selected: plan?.troops?.type,
        onPick: (type) => {
          setTroopType(type);
          setCount("max");
        },
      }}
      art={plan?.troops ? armyArt({ category: plan.troops.type, tier: plan.troops.tier }) : undefined}
      troopsAtHome={plan ? (plan.troops?.atHome ?? 0) : undefined}
      count={preview?.count}
      amount={{ most: range.wheatMax, max: range.max }}
      onCount={(next) => setCount(range.max > 0 && next === range.max ? "max" : next)}
      start={start}
      slots={{ open: plan?.open, onPick: pickSlot }}
      troopsWait={nextTroopIn}
      wheatCost={preview?.wheatCost}
      tile={start && center ? (direction === null ? "none" : "open") : undefined}
      canDeploy={Boolean(plan?.troops && preview && direction !== null && start)}
      sending={deploying}
      onDeploy={() => void deploy()}
      wheatLimit={
        plan?.raise && march && wheatStop
          ? {
              ...wheatStop,
              held: plan.raise.wheat,
              perTroop: plan.raise.wheatToGo(1, march),
              wait: secondsUntilHeld(plan.raise.wheat, plan.raise.wheatToGo(1, march), wheatPerHour),
            }
          : undefined
      }
      onGoToRealm={() => {
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
