import { useGame } from "@/hooks/context/game-context";
import { useBlockTimestamp, useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { computeEffectiveStaminaCost } from "@/hooks/exploration-automation-planner";
import {
  ActionPaths,
  ActionType,
  computeExploreFoodCosts,
  computeTravelFoodCosts,
  configManager,
  divideByPrecision,
  getBalance,
  ResourceManager,
  StaminaManager,
} from "@bibliothecadao/eternum";
import { resolveExplorerTroops } from "@bibliothecadao/eternum/troop-stamina";
import { ResourcesIds, TickIds, type Troops } from "@bibliothecadao/types";

const ORDER_MODELS = [
  "ExplorerTroops",
  "ArmySlot",
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
export const useArmyOrder = (): ArmyOrder | null => {
  const { setup } = useGame();
  useNativeRevision(ORDER_MODELS);
  const { currentArmiesTick, armiesTickTimeRemaining } = useBlockTimestamp();
  const tick = useCurrentDefaultTick();
  const { selectedEntityId, hoveredHex, actionPaths } = useUIStore((state) => state.entityActions);
  if (selectedEntityId === null || selectedEntityId === undefined || !hoveredHex) return null;
  const path = actionPaths.get(ActionPaths.posKey(hoveredHex, true));
  if (!path || path.length < 2) return null;
  const actionType = ActionPaths.getActionType(path);
  if (actionType !== ActionType.Explore && actionType !== ActionType.Move) return null;
  const gameId = configManager.getActiveGameId();
  const army = setup.store.get("ExplorerTroops", { game_id: gameId, explorer_id: selectedEntityId });
  if (!army) return null;
  const troops = resolveExplorerTroops(setup.store, army);
  const explore = actionType === ActionType.Explore;
  const tiles = path.length - 1;

  const staminaCost = computeEffectiveStaminaCost(path.slice(1), actionType, configManager.getExploreStaminaCost());
  const staminaHeld = troops ? Number(StaminaManager.getStamina(troops, currentArmiesTick).amount) : undefined;
  const wheatCost = Math.abs(
    explore
      ? computeExploreFoodCosts(army.troops).wheatPayAmount
      : computeTravelFoodCosts(army.troops).wheatPayAmount * tiles,
  );
  const wheatBalance = getBalance(army.owner, ResourcesIds.Wheat, tick, setup.store).balance;
  const wheatHeld = wheatBalance === undefined ? undefined : divideByPrecision(wheatBalance);
  const wheatPerHour = new ResourceManager(setup.store, army.owner).wheatPerHour(tick);

  return {
    kind: explore ? "explore" : "move",
    target: hoveredHex,
    tiles,
    stamina: {
      cost: staminaCost,
      held: staminaHeld,
      wait:
        troops && staminaHeld !== undefined && staminaHeld < staminaCost
          ? secondsUntilStamina(troops, staminaCost, currentArmiesTick, armiesTickTimeRemaining)
          : undefined,
    },
    wheat: { cost: wheatCost, held: wheatHeld, wait: secondsUntilHeld(wheatHeld, wheatCost, wheatPerHour) },
    xp: explore ? setup.store.get("ArmyProgressionRules", { game_id: gameId })?.reveal_xp : undefined,
  };
};

/**
 * When the army's stamina first reaches `need`: the rest of this tick, then whole ticks, as the contract refills it.
 * Undefined when its stamina never gets there today.
 */
const secondsUntilStamina = (
  troops: Troops,
  need: number,
  currentTick: number,
  tickRemaining: number,
): number | undefined => {
  const full = StaminaManager.getFullAtTick(troops, currentTick);
  if (full === null) return undefined;
  const tickSeconds = Number(configManager.getTick(TickIds.Armies));
  for (let tick = currentTick + 1; tick <= full; tick += 1) {
    if (Number(StaminaManager.getStamina(troops, tick).amount) >= need) {
      return tickRemaining + (tick - currentTick - 1) * tickSeconds;
    }
  }
  return undefined;
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
