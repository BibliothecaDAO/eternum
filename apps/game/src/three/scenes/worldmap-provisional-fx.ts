import { gameEntityKey } from "@/dojo/game-scope";
import { requireActiveGameSyncRuntime, type ProvisionalIntent } from "@bibliothecadao/eternum/game-sync";
import { ActorType, Direction, HexPosition, ID, TroopTier, TroopType } from "@bibliothecadao/types";

export type WorldmapProvisionalFxSpec =
  | {
      kind: "create-army";
      structureId: ID;
      direction: Direction;
      troopType: TroopType;
      troopTier: TroopTier;
    }
  | {
      kind: "attack";
      attackerHex: HexPosition;
      targetHex: HexPosition;
    };

export interface WorldmapProvisionalFxRenderer {
  start(spec: WorldmapProvisionalFxSpec, intent: ProvisionalIntent): void;
}

let activeRenderer: WorldmapProvisionalFxRenderer | null = null;

export const registerWorldmapProvisionalFxRenderer = (renderer: WorldmapProvisionalFxRenderer): (() => void) => {
  activeRenderer = renderer;
  return () => {
    if (activeRenderer === renderer) activeRenderer = null;
  };
};

export const startWorldmapProvisionalFx = (spec: WorldmapProvisionalFxSpec, intent: ProvisionalIntent): void => {
  activeRenderer?.start(spec, intent);
};

export const createAttackProvisionalIntent = (attackerId: ID, actorType: ActorType): ProvisionalIntent => {
  const model = actorType === ActorType.Explorer ? "ExplorerTroops" : "Structure";
  const baselineDeltaField = actorType === ActorType.Explorer ? "troops" : "troop_guards";
  return requireActiveGameSyncRuntime().createProvisionalIntent([
    {
      entityId: gameEntityKey([BigInt(attackerId)]),
      model,
      baselineDeltaFields: [baselineDeltaField],
    },
  ]);
};
