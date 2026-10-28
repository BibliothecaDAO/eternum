import { useGame } from "@/hooks/context/game-context";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { pinsOrder } from "@/three/scenes/worldmap-order-request";
import { computeEffectiveStaminaCost } from "@/lib/army-stamina/path-cost";
import { orderFood } from "./order-tip";
import {
  ActionPaths,
  ActionType,
  configManager,
  divideByPrecision,
  getBalance,
  ResourceManager,
  readRevealXp,
  FELT_CENTER,
  StaminaManager,
} from "@bibliothecadao/eternum";
import { resolveExplorerTroops } from "@bibliothecadao/eternum/troop-stamina";
import { ResourcesIds, type Troops } from "@bibliothecadao/types";
import { safeInteger } from "@bibliothecadao/eternum/game-client";

const ORDER_MODELS = [
  "ExplorerTroops",
  "ArmySlot",
  "ArmyProgress",
  "ResourceBalance",
  "ResourceProduction",
  "ArmyProgressionRules",
] as const;

/** A cost the army or its realm pays, held against what it has, with the exact wait when it is short. */
export type Cost = { cost: number; held: number | undefined; wait: number | undefined };

/** The order the player has pinned for the selected army: where it goes, and what it pays and earns. */
export type ArmyOrder = {
  kind: "explore" | "move";
  target: { col: number; row: number };
  tiles: number;
  stamina: Cost;
  wheat: Cost;
  /** Explore only: XP per new tile (read from the preset). */
  xp: number | undefined;
};

/** Whether a cost is covered now; unknown is never covered. */
export const isCovered = ({ cost, held }: Cost): boolean => held !== undefined && held >= cost;

/**
 * The pinned order over the game's facts: the selected army and the tile the player tapped (or hovers on a desktop),
 * when that tile is one to explore or move to. Null otherwise.
 */
export const useArmyOrder = (): ArmyOrder | null => useOrderAt(useUIStore((state) => state.entityActions.hoveredHex));

/** The selected army's order at a tile (normalized), when it can explore or move there; null otherwise. */
export const useOrderAt = (target: { col: number; row: number } | null): ArmyOrder | null => {
  const { setup } = useGame();
  useNativeRevision(ORDER_MODELS);
  const tick = useCurrentDefaultTick();
  const { selectedEntityId, actionPaths } = useUIStore((state) => state.entityActions);
  if (selectedEntityId === null || selectedEntityId === undefined || !target) return null;
  const path = actionPaths.get(ActionPaths.posKey(target, true));
  if (!path || !pinsOrder(path)) return null;
  const actionType = ActionPaths.getActionType(path);
  const gameId = configManager.getActiveGameId();
  const army = setup.store.get("ExplorerTroops", { game_id: gameId, explorer_id: selectedEntityId });
  if (!army) return null;
  const troops = resolveExplorerTroops(setup.store, army);
  const explore = actionType === ActionType.Explore;
  const tiles = path.length - 1;

  const staminaCost = computeEffectiveStaminaCost(path.slice(1), actionType, configManager.getExploreStaminaCost());
  const staminaHeld = troops ? Number(StaminaManager.getStamina(troops, tick).amount) : undefined;
  // Frontier's preset charges no fish; the wheat is the order's whole food.
  const wheatCost = orderFood(path, army.troops).wheat;
  const wheatBalance = getBalance(safeInteger(army.owner), ResourcesIds.Wheat, tick, setup.store).balance;
  const wheatHeld = wheatBalance === undefined ? undefined : divideByPrecision(wheatBalance, false);
  const wheatPerHour = new ResourceManager(setup.store, safeInteger(army.owner)).wheatPerHour(tick);

  return {
    kind: explore ? "explore" : "move",
    target,
    tiles,
    stamina: {
      cost: staminaCost,
      held: staminaHeld,
      wait:
        troops && staminaHeld !== undefined && staminaHeld < staminaCost
          ? secondsUntilStamina(troops, staminaCost, tick)
          : undefined,
    },
    wheat: { cost: wheatCost, held: wheatHeld, wait: secondsUntilHeld(wheatHeld, wheatCost, wheatPerHour) },
    xp: explore ? readRevealXp(setup.store, gameId, { y: target.row + FELT_CENTER() }) : undefined,
  };
};

/**
 * The stamina the selected army holds now, and when it reaches `need`: an attack's cost held against what it has.
 */
export const useArmyStamina = (explorerId: number | null, need: number): Cost | undefined => {
  const tick = useCurrentDefaultTick();
  useNativeRevision(ORDER_MODELS);
  const { setup } = useGame();
  if (explorerId === null) return undefined;
  const army = setup.store.get("ExplorerTroops", { game_id: configManager.getActiveGameId(), explorer_id: explorerId });
  const troops = army && resolveExplorerTroops(setup.store, army);
  if (!troops) return undefined;
  const held = Number(StaminaManager.getStamina(troops, tick).amount);
  return {
    cost: need,
    held,
    wait: held < need ? secondsUntilStamina(troops, need, tick) : undefined,
  };
};

/** Seconds until the army can afford this order, including any remaining boost. */
const secondsUntilStamina = (troops: Troops, need: number, timestamp: number): number | undefined => {
  const ready = StaminaManager.getAffordableAt(troops, need, timestamp);
  return ready === null ? undefined : Math.max(0, ready - timestamp);
};

/** How long until the realm's farms bring the held wheat up to `need`; undefined when it already holds it or never will. */
export const secondsUntilHeld = (
  held: number | undefined,
  need: number,
  perHour: number | undefined,
): number | undefined => {
  if (held === undefined || held >= need || !perHour || perHour <= 0) return undefined;
  return ((need - held) / perHour) * 3_600;
};

/** What the realm makes of a resource an hour at the rates running now; undefined where it holds none of it. */
export const realmPerHour = (
  store: Parameters<typeof getBalance>[3],
  realmId: number,
  resourceId: ResourcesIds,
  tick: number,
): number | undefined => {
  const resource = new ResourceManager(store, realmId).current(resourceId);
  return (
    resource && ResourceManager.calculateResourceProductionData(resourceId, resource, tick).productionPerSecond * 3_600
  );
};
