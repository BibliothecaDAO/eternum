import { BuildingType, type ID, type ResourcesIds } from "@bibliothecadao/types";
import type { GameClientSetup } from "../client/game-client";
import { configManager } from "../managers/config-manager";
import { divideByPrecision } from "../utils/utils";
import { storyEventKeys } from "../sync/story-event-identity";
import type {
  BattleEventSystemUpdate,
  BuildingSystemUpdate,
  ExplorerRewardSystemUpdate,
  RelicChestOpenedSystemUpdate,
  ChestRewardSystemUpdate,
} from "./types";

type Fields = Record<string, unknown>;
const fields = (value: unknown): Fields | undefined =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Fields) : undefined;
const integer = (value: unknown): number => {
  if (typeof value !== "number" && typeof value !== "string" && typeof value !== "bigint")
    throw new Error("Invalid native event integer");
  const result = Number(value);
  if (!Number.isSafeInteger(result)) throw new Error("Invalid native event integer");
  return result;
};

/** Current facts drive scene updates; deduplicated runtime events drive transient effects. */
export class WorldUpdateListener {
  constructor(private readonly setup: GameClientSetup) {}

  get Buildings() {
    return {
      onBuildingUpdate: (structureId: ID, callback: (value: BuildingSystemUpdate) => void): (() => void) =>
        this.setup.store.subscribe((changes) => {
          for (const change of changes) {
            if (change.model !== "Building") continue;
            const row = change.current ?? change.previous;
            if (!row || row.game_id !== configManager.getActiveGameId() || row.structure_id !== structureId) continue;
            callback({
              buildingType: change.current?.category ?? BuildingType.None,
              innerCol: row.inner_col,
              innerRow: row.inner_row,
              paused: change.current?.paused ?? false,
            });
          }
        }),
    };
  }

  get StructureEntityListener() {
    return {
      onLevelUpdate: (entityId: ID, callback: (update: { entityId: ID; level: number }) => void) => ({
        unsubscribe: this.setup.store.subscribe((changes) => {
          for (const change of changes) {
            if (
              change.model === "Structure" &&
              change.current?.game_id === configManager.getActiveGameId() &&
              change.current.entity_id === entityId
            )
              callback({ entityId, level: change.current.base.level });
          }
        }),
      }),
    };
  }

  private onStory(name: string, callback: (payload: Fields, event: Fields) => void): () => void {
    return this.setup.store.subscribeEvents((event) => {
      const story = event.model === "StoryEvent" ? fields(event.value) : undefined;
      if (!story || integer(story.game_id) !== configManager.getActiveGameId()) return;
      const payload = fields(fields(story.story)?.[name]);
      if (payload) callback(payload, story);
    });
  }

  get RelicChest() {
    return {
      onRelicChestOpened: (callback: (value: RelicChestOpenedSystemUpdate) => void) =>
        this.onStory("RelicChestOpened", (payload, event) => {
          const coord = fields(payload.coord);
          if (!coord || !Array.isArray(payload.relics)) throw new Error("Malformed chest opening");
          callback({
            explorerId: integer(payload.explorer_id),
            hex: { x: integer(coord.x), y: integer(coord.y) },
            relics: payload.relics.map(integer) as ResourcesIds[],
            timestamp: integer(event.timestamp),
          });
        }),
    };
  }

  get ChestRewards() {
    return {
      onChestReward: (callback: (value: ChestRewardSystemUpdate) => void) =>
        this.onStory("ChestReward", (payload, event) => {
          const kind = typeof payload.kind === "string" ? payload.kind : Object.keys(fields(payload.kind) ?? {})[0];
          callback({
            resultKey: storyEventKeys(event),
            explorerId: integer(payload.explorer_id),
            kind: kind === "Cosmetic" || kind === "Token" ? kind : "Relic",
            quality: integer(payload.quality),
            depth: integer(payload.depth),
            timestamp: integer(event.timestamp),
          });
        }),
    };
  }

  get ExplorerReward() {
    return {
      onExplorerRewardEventUpdate: (callback: (value: ExplorerRewardSystemUpdate) => void) =>
        this.onStory("ExplorationReward", (payload, event) => {
          const explorerId = integer(payload.explorer_id);
          const explorer = this.setup.store.get("ExplorerTroops", {
            game_id: configManager.getActiveGameId(),
            explorer_id: explorerId,
          });
          const owner = event.owner;
          callback({
            explorerId,
            explorerStructureId: explorer?.owner ?? 0,
            explorerOwnerAddress: owner === undefined || owner === null ? null : BigInt(String(owner)),
            resourceId: integer(payload.resource_type) as ResourcesIds,
            rawAmount: BigInt(String(payload.amount)),
            amount: divideByPrecision(Number(payload.amount)),
            coord: { x: integer(fields(payload.coord)?.x), y: integer(fields(payload.coord)?.y) },
            timestamp: integer(event.timestamp),
          });
        }),
    };
  }

  get BattleEvent() {
    return {
      onBattleUpdate: (callback: (value: BattleEventSystemUpdate) => void) =>
        this.setup.store.subscribeEvents((event) => {
          const battle = event.model === "BattleEvent" ? fields(event.value) : undefined;
          if (!battle || integer(battle.game_id) !== configManager.getActiveGameId()) return;
          const attackerId = integer(battle.attacker_id);
          const defenderId = integer(battle.defender_id);
          const attackerOwner = integer(battle.attacker_owner);
          const defenderOwner = integer(battle.defender_owner);
          const winnerId = integer(battle.winner_id);
          if (!Array.isArray(battle.max_reward)) throw new Error("Malformed battle rewards");
          const maxReward = battle.max_reward.map((value) => {
            const row = fields(value);
            if (!row) throw new Error("Malformed battle reward");
            return { resourceType: integer(row.resource_type), amount: divideByPrecision(Number(row.amount)) };
          });
          callback({
            entityId: winnerId === attackerOwner ? attackerId : defenderId,
            battleData: {
              attackerId,
              defenderId,
              attackerOwner,
              defenderOwner,
              winnerId,
              maxReward,
              timestamp: integer(battle.timestamp),
            },
          });
        }),
    };
  }
}
