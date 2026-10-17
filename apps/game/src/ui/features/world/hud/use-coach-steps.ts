import { useGame } from "@/hooks/context/game-context";
import { useCurrentDefaultTick, useNowMs } from "@/hooks/helpers/use-block-timestamp";
import { useNavigateToMapView } from "@/hooks/helpers/use-navigate";
import { useAccountAddress } from "@/hooks/store/use-account-store";
import { useStoryEvents } from "@/hooks/store/use-story-events-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useFactView } from "@/hooks/use-fact-view";
import { gameStructuresView, selectableArmiesView } from "@/sync/fact-views";
import { requestArmySelection } from "@/three/scenes/worldmap-army-select-request";
import { LeftView } from "@/types";
import { lostArmyLine } from "@/ui/features/event-feed/row-outcomes";
import { getExplorerStaminaSnapshot } from "@/utils/explorer-stamina";
import { configManager, Position, structureMapPosition } from "@bibliothecadao/eternum";
import { getActiveGameSyncRuntime } from "@bibliothecadao/eternum/game-sync";
import { resolveExplorerTroops } from "@bibliothecadao/eternum/troop-stamina";
import { StructureType } from "@bibliothecadao/types";
import { useEffect, useMemo, useState } from "react";
import { type CoachAct, type CoachArmy, type CoachStep, type CoachTarget, coachSteps } from "./coach";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";

/** How long a lost army stays Next up's alert: long enough to be read after the fight, not for the rest of the game. */
const LOST_ARMY_ALERT_MS = 5 * 60_000;

/** A Next up step: its line, its one verb, and what the verb does. */
export interface CoachNextStep {
  key: string;
  line: string;
  verb: string;
  run: () => void;
}

/** The coach's steps for the player now, from their armies and what scores on the map, each with its action. */
export const useCoachSteps = (): CoachNextStep[] => {
  const armies = useCoachArmies();
  const targets = useCoachTargets();
  const act = useCoachAct();
  return useMemo(
    () =>
      coachSteps({
        armies,
        targets,
        exploreStaminaCost: configManager.getExploreStaminaCost(),
        grants: configManager.getVictoryPointGrants(),
      }).map((step) => toNextStep(step, act)),
    [armies, targets, act],
  );
};

/**
 * The player's army that fell in a fight in the last few minutes, as an alert to raise another; none otherwise. It
 * is an alert, so it shows with tips off too.
 */
export const useLostArmyAlert = (): CoachNextStep[] => {
  const viewer = useAccountAddress();
  const address = viewer === null ? null : `0x${viewer.toString(16)}`;
  const { data: battles } = useStoryEvents(20, "BattleEvent", address ?? undefined);
  const nowMs = useNowMs();
  const act = useCoachAct();
  return useMemo(() => {
    const lost = battles
      .filter((battle) => nowMs - battle.timestampMs < LOST_ARMY_ALERT_MS)
      .map((battle) => ({ battle, line: lostArmyLine(battle.storyPayload, address) }))
      .find(({ line }) => line !== null);
    if (!lost?.line) return [];
    return [
      toNextStep(
        {
          key: `lost:${lost.battle.id}`,
          line: `${lost.line}. Raise another.`,
          verb: "Raise an army",
          act: { kind: "raise" },
        },
        act,
      ),
    ];
  }, [battles, nowMs, address, act]);
};

const toNextStep = (step: CoachStep, act: (action: CoachAct) => void): CoachNextStep => ({
  key: step.key,
  line: step.line,
  verb: step.verb,
  run: () => act(step.act),
});

/** What a coach step's verb does: open Military on the selected holding, or select the army and show the hex. */
const useCoachAct = () => {
  const navigate = useNavigateToMapView();
  return useMemo(
    () => (action: CoachAct) => {
      if (action.kind === "raise") {
        useUIStore.getState().setLeftNavigationView(LeftView.MilitaryView);
        return;
      }
      requestArmySelection(action.armyId);
      navigate(Position.fromContract({ x: action.hex.col, y: action.hex.row }));
    },
    [navigate],
  );
};

/** The player's armies in the field, where they stand on the shown layer and the stamina each has now. */
const useCoachArmies = (): CoachArmy[] => {
  const { setup } = useGame();
  const armies = useFactView(selectableArmiesView);
  const timestamp = useCurrentDefaultTick();
  const { projection, revision } = useProjectionRevision();
  return useMemo(
    () =>
      armies.flatMap(({ entityId }) => {
        const placed = projection?.getArmy(entityId);
        const explorer = setup.store.get("ExplorerTroops", {
          game_id: configManager.getActiveGameId(),
          explorer_id: entityId,
        });
        if (!placed || !explorer) return [];
        const snapshot = getExplorerStaminaSnapshot({
          timestamp,
          liveTroops: resolveExplorerTroops(setup.store, explorer),
        });
        return [{ entityId, hex: placed.hexCoords, stamina: snapshot?.current ?? 0 }];
      }),
    [armies, setup.store, timestamp, projection, revision],
  );
};

/** Sites a camp or rift's capture pays for: what The Vanguard holds that is not a realm, village or Hyperstructure. */
const SITE_CATEGORIES = new Set<number>([StructureType.Camp, StructureType.Mine, StructureType.Rift]);

/** What scores on the map that the player can see: crates, The Vanguard's camps and rifts, and Hyperstructures. */
const useCoachTargets = (): CoachTarget[] => {
  const { setup } = useGame();
  const mode = useGameModeConfig();
  const structures = useFactView(gameStructuresView);
  const { projection, revision } = useProjectionRevision();
  const mapLayer = useUIStore((state) => state.mapLayer);
  return useMemo(() => {
    const crates: CoachTarget[] = (projection?.getChests(mapLayer) ?? []).map((chest) => ({
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
  }, [projection, revision, mapLayer, structures, setup.store, mode]);
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

/** The world's spatial projection, and a revision that moves whenever an army or a chest moves on it. */
const useProjectionRevision = () => {
  const projection = getActiveGameSyncRuntime()?.getWorldSpatialProjection() ?? null;
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!projection) return;
    const bump = () => setRevision((current) => current + 1);
    const armies = projection.subscribeArmies(bump);
    const chests = projection.subscribeChests(bump);
    return () => {
      armies();
      chests();
    };
  }, [projection]);
  return { projection, revision };
};
