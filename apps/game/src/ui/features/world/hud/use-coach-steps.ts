import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useGame } from "@/hooks/context/game-context";
import { useCurrentDefaultTick, useNowMs } from "@/hooks/helpers/use-block-timestamp";
import { useSelectArmyOnMap } from "@/hooks/helpers/use-navigate";
import { useNativeFacts } from "@/hooks/helpers/use-native-facts";
import { useQuery } from "@/hooks/helpers/use-query";
import { useAccountAddress } from "@/hooks/store/use-account-store";
import { useStoryEvents } from "@/hooks/store/use-story-events-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useFactView } from "@/hooks/use-fact-view";
import { useSpatialProjection } from "@/hooks/use-spatial-projection";
import { gameStructuresView, playerStructuresView, selectableArmiesView } from "@/sync/fact-views";
import { requestChestOpening } from "@/three/scenes/worldmap-chest-open-request";
import { LeftView } from "@/types";
import { forecastAttack } from "@/ui/features/military/battle/fight-forecast";
import { openArmyDeployment } from "@/ui/features/military/utils/open-army-deployment";
import { knownAmount } from "@/ui/utils/utils";
import {
  ArmyActionManager,
  biomeTypeOf,
  configManager,
  getGuardsByStructure,
  getBalance,
  getTileAt,
  getTroopResourceId,
  lostArmyLine,
  Position,
  structureMapPosition,
} from "@bibliothecadao/eternum";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { resolveExplorerTroops } from "@bibliothecadao/eternum/troop-stamina";
import { BiomeType, StructureType, TroopTier, TroopType, formatCount } from "@bibliothecadao/types";
import { useMemo } from "react";
import {
  type CoachAct,
  type CoachArmy,
  type CoachStep,
  type CoachTarget,
  coachSteps,
  raiseStep,
  type TroopsOnHand,
} from "./coach";
import type { NextStep } from "./next-step";
import type { TroopStack } from "@/ui/features/military/components/unified-army-creation-modal/types";

/** How long a lost army stays Next up's alert: long enough to be read after the fight, not for the rest of the game. */
const LOST_ARMY_ALERT_MS = 5 * 60_000;

/** A coach act Next up's button takes; a level-up is the realm's own step, sent by its hook. */
type ButtonAct = Exclude<CoachAct, { kind: "level-up" }>;

/** The coach's steps for the player now, ranked by what scores, each as Next up's step. */
export const useCoachSteps = (): NextStep[] => {
  const holds = useFactView(playerStructuresView).length > 0;
  const armies = useCoachArmies();
  const targets = useCoachTargets();
  const troopsOnHand = useTroopsOnHand();
  const certainLoss = useCertainLoss();
  const act = useCoachAct();
  const steps = useMemo(
    () =>
      coachSteps({ holds, armies, targets, troopsOnHand, certainLoss, grants: configManager.getVictoryPointGrants() }),
    [holds, armies, targets, troopsOnHand, certainLoss],
  );
  return steps.map((step) => toNextStep(step, act));
};

/**
 * The player's army that fell in a fight in the last few minutes, as an alert to raise another where troops are on
 * hand, while they have no army in the field and hold somewhere to raise one; none once one stands again (the loss
 * stays in Events and the Log). It is an alert, so it shows with tips off too.
 */
export const useLostArmyAlert = (): NextStep[] => {
  const inTheField = useFactView(selectableArmiesView).length > 0;
  const holds = useFactView(playerStructuresView).length > 0;
  const viewer = useAccountAddress();
  const address = viewer === null ? null : `0x${viewer.toString(16)}`;
  const { data: battles } = useStoryEvents(20, "BattleEvent", address ?? undefined);
  const nowMs = useNowMs();
  const troopsOnHand = useTroopsOnHand();
  const act = useCoachAct();
  const lost = useMemo(
    () =>
      battles
        .filter((battle) => nowMs - battle.timestampMs < LOST_ARMY_ALERT_MS)
        .map((battle) => ({ battle, line: lostArmyLine(battle.storyPayload, address) }))
        .find(({ line }) => line !== null),
    [battles, nowMs, address],
  );
  if (!lost?.line || inTheField || !holds) return [];
  const raise = raiseStep({ troopsOnHand, grants: configManager.getVictoryPointGrants() });
  const next = troopsOnHand
    ? `Raise another at ${troopsOnHand.realmName} (${formatCount(troopsOnHand.stack.count, "troop")} on hand).`
    : raise.line;
  return [toNextStep({ ...raise, key: `lost:${lost.battle.id}`, line: `${lost.line}. ${next}` }, act)];
};

const toNextStep = (step: CoachStep, act: (action: ButtonAct) => void): NextStep => {
  const action = step.act;
  if (action?.kind === "level-up") {
    return { key: step.key, kind: "level-up", realmId: action.realmId, name: action.name, why: step.line };
  }
  return {
    key: step.key,
    kind: "order",
    line: step.line,
    verb: step.verb,
    busy: false,
    run: action ? () => act(action) : null,
  };
};

/** The coach follows armies and crates as they move on the map. */
const COACH_LAYERS = ["armies", "chests"] as const;

/** A coach hex is the projection's, in contract coordinates: the place the map is asked to show. */
const coachPlace = (hex: { col: number; row: number }): Position => Position.fromContract({ x: hex.col, y: hex.row });

/**
 * What a coach step's button does: open Military on the realm it names, on the troop stack it named, open Build, open a crate beside an army (on
 * the map; from another view the army is shown there first), or select the army on the map with its target's card
 * open.
 */
const useCoachAct = () => {
  const selectArmy = useSelectArmyOnMap();
  const { isMapView } = useQuery();
  return (action: ButtonAct) => {
    switch (action.kind) {
      case "raise":
        openArmyDeployment({ structureId: action.realmId, isExplorer: true, troops: action.troops });
        return;
      case "build":
        useUIStore.getState().setLeftNavigationView(LeftView.ConstructionView);
        return;
      case "open-crate":
        if (isMapView) requestChestOpening({ explorerId: action.armyId, hex: action.hex });
        else selectArmy(action.armyId, coachPlace(action.hex));
        return;
      case "go":
        selectArmy(action.armyId, action.target && coachPlace(action.target));
        return;
    }
  };
};

/**
 * The player's armies in the field: where they stand on the shown layer, their home realm, whether an explore order
 * would go now by the order's own rule (the army's stamina and its home's food), and which one is selected.
 */
const useCoachArmies = (): CoachArmy[] => {
  const { setup } = useGame();
  const mode = useGameModeConfig();
  const armies = useFactView(selectableArmiesView);
  const timestamp = useCurrentDefaultTick();
  const facts = useNativeFacts(["ExplorerTroops", "ResourceBalance", "ResourceProduction"]);
  const selectedId = useUIStore((state) => state.entityActions.selectedEntityId);
  const spatial = useSpatialProjection(COACH_LAYERS);
  return useMemo(
    () =>
      armies.flatMap(({ entityId }) => {
        const placed = spatial.projection?.getArmy(entityId);
        const explorer = facts.store.get("ExplorerTroops", {
          game_id: configManager.getActiveGameId(),
          explorer_id: entityId,
        });
        if (!placed || !explorer) return [];
        const homeId = Number(explorer.owner);
        const home = facts.store.get("Structure", { game_id: configManager.getActiveGameId(), entity_id: homeId });
        return [
          {
            entityId,
            hex: placed.hexCoords,
            home: {
              realmId: homeId,
              name: home ? mode.structure.getName(home).name : "its realm",
              canLevelUp: home ? home.base.level < configManager.getMaxLevel(home.base.category) : false,
            },
            canExplore: new ArmyActionManager(facts.store, setup.systemCalls, entityId).canExplore(timestamp),
            selected: selectedId === entityId,
          },
        ];
      }),
    [armies, setup.systemCalls, mode, timestamp, facts, selectedId, spatial],
  );
};

/** The troops a realm can raise an army from: every troop type and tier. */
const TROOP_KINDS = [TroopType.Knight, TroopType.Crossbowman, TroopType.Paladin].flatMap((type) =>
  [TroopTier.T1, TroopTier.T2, TroopTier.T3].map((tier) => ({ type, tier })),
);

/**
 * The player's holding with the largest troop stack on hand, and that stack, where an army can be raised now; null when
 * none holds any. On hand is what Military offers: the stored troops and what the barracks trained since, within
 * storage, at chain time.
 */
const useTroopsOnHand = (): TroopsOnHand | null => {
  const mode = useGameModeConfig();
  const structures = useFactView(playerStructuresView);
  const tick = useCurrentDefaultTick();
  const facts = useNativeFacts(["ResourceBalance", "ResourceProduction", "ResourceWeight"]);
  return useMemo(
    () =>
      structures
        .map((structure) => ({
          realmId: structure.entityId,
          realmName: mode.structure.getName(structure.structure).name,
          stack: largestStack(facts.store, structure.entityId, tick),
        }))
        .reduce<TroopsOnHand | null>(
          (most, realm) => (realm.stack.count > (most?.stack.count ?? 0) ? realm : most),
          null,
        ),
    [structures, mode, tick, facts],
  );
};

/**
 * The largest stack a holding can raise one army from now, as Military counts it: an army is of one type and tier, so
 * its largest stack (the troop and its whole count), not every stack together.
 */
const largestStack = (store: NativeFactStore, entityId: number, tick: number): TroopStack =>
  TROOP_KINDS.map(({ type, tier }) => ({
    type,
    tier,
    count: Math.floor(knownAmount(getBalance(entityId, getTroopResourceId(type, tier), tick, store).balance) ?? 0),
  })).reduce((largest, stack) => (stack.count > largest.count ? stack : largest));

/**
 * Whether an army attacking a target's first guard, as both stand now on the target's tile, is wiped out at any roll:
 * the attack preview's own forecast. A target with no guard standing is no loss.
 */
const useCertainLoss = () => {
  const timestamp = useCurrentDefaultTick();
  const facts = useNativeFacts(["ExplorerTroops", "Guard", "ArmySlot", "Structure", "TileOccupancy"]);
  return useMemo(() => {
    const gameId = configManager.getActiveGameId();
    return (army: CoachArmy, target: CoachTarget): boolean => {
      const tile = getTileAt(facts.store, false, target.hex.col, target.hex.row);
      const structure = tile && facts.store.get("Structure", { game_id: gameId, entity_id: Number(tile.occupier_id) });
      const guard = structure
        ? (getGuardsByStructure(structure, facts.store) ?? [])
            .filter((slot) => slot.troops.count > 0n)
            .toSorted((left, right) => left.slot - right.slot)[0]
        : undefined;
      const explorer = facts.store.get("ExplorerTroops", { game_id: gameId, explorer_id: army.entityId });
      const troops = explorer ? resolveExplorerTroops(facts.store, explorer) : undefined;
      if (!guard || !troops) return false;
      const biome = tile && tile.biome !== 0 ? biomeTypeOf(tile.biome) : BiomeType.None;
      const circumstances = {
        timestamp,
        attackDistance: 1,
        attackerBiome: biome,
        defenderBiome: biome,
        attackerIsStructureGuard: false,
        defenderIsStructureGuard: true,
      };
      const rules = { rules: configManager.getCombatRules(), rollsDice: configManager.rollsCombatDice(false) };
      return forecastAttack(troops, guard.troops, circumstances, rules).certainLoss;
    };
  }, [timestamp, facts]);
};

/** Sites a camp or rift's capture pays for: what The Vanguard holds that is not a realm, village or Hyperstructure. */
const SITE_CATEGORIES = new Set<number>([StructureType.Camp, StructureType.Mine, StructureType.Rift]);

/** What scores on the map that the player can see: crates, The Vanguard's camps and rifts, and Hyperstructures. */
const useCoachTargets = (): CoachTarget[] => {
  const { setup } = useGame();
  const mode = useGameModeConfig();
  const structures = useFactView(gameStructuresView);
  const spatial = useSpatialProjection(COACH_LAYERS);
  const mapLayer = useUIStore((state) => state.mapLayer);
  return useMemo(() => {
    const crates: CoachTarget[] = (spatial.projection?.getChests(mapLayer) ?? []).map((chest) => ({
      kind: "crate",
      name: "the relic crate",
      hex: chest.hexCoords,
    }));
    const held: CoachTarget[] = structures.flatMap((structure) => {
      const kind = targetKind(structure.base.category, structure.owner);
      const site = kind && structureMapPosition(setup.store, structure);
      return kind && site
        ? [{ kind, name: mode.structure.getName(structure).name, hex: { col: site.x, row: site.y } }]
        : [];
    });
    return [...crates, ...held];
  }, [spatial, mapLayer, structures, setup.store, mode]);
};

/**
 * A structure's place on the coach's route: what The Vanguard holds pays its capture (a Hyperstructure +1,000, a camp
 * or rift +250, as the contract's register_capture grants); a player's holding pays no capture bonus, so is none.
 */
const targetKind = (category: number, owner: bigint): CoachTarget["kind"] | null => {
  if (owner !== 0n) return null;
  if (category === StructureType.Hyperstructure) return "hyperstructure";
  return SITE_CATEGORIES.has(category) ? "site" : null;
};
