import { BuildingType, type ID, type ResourcesIds } from "@bibliothecadao/types";
import type { GameClientSetup } from "../client/game-client";
import { configManager } from "../managers/config-manager";
import { divideByPrecision } from "../utils/utils";
import { storyEventKeys } from "../sync/story-event-identity";
import type {
  BattleEventSystemUpdate,
  BuildingSystemUpdate,
  AttributeChosenSystemUpdate,
  ExplorerRewardSystemUpdate,
  RelicChestOpenedSystemUpdate,
  ChestRewardSystemUpdate,
  SitePayoutSystemUpdate,
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

  get Attributes() {
    return {
      onAttributeChosen: (callback: (value: AttributeChosenSystemUpdate) => void) =>
        this.onStory("AttributeChosen", (payload) => {
          const attribute =
            typeof payload.attribute === "string" ? payload.attribute : Object.keys(fields(payload.attribute) ?? {})[0];
          if (!isAttribute(attribute)) throw new Error("Malformed attribute choice");
          callback({
            explorerId: integer(payload.explorer_id),
            offerId: integer(payload.offer_id),
            attribute,
            applied: integer(payload.applied),
            lost: integer(payload.lost),
          });
        }),
    };
  }

  get ChestRewards() {
    return {
      onChestReward: (callback: (value: ChestRewardSystemUpdate) => void) =>
        this.onStory("ChestReward", (payload, event) => {
          const kind = typeof payload.kind === "string" ? payload.kind : Object.keys(fields(payload.kind) ?? {})[0];
          if (kind !== "Relic" && kind !== "Token") throw new Error("Invalid chest reward kind");
          if (typeof payload.lords_exhausted !== "boolean") throw new Error("Missing chest budget result");
          callback({
            resultKey: storyEventKeys(event),
            explorerId: integer(payload.explorer_id),
            kind,
            lordsExhausted: payload.lords_exhausted,
            quality: integer(payload.quality),
            depth: integer(payload.depth),
            timestamp: integer(event.timestamp),
          });
        }),
    };
  }

  get SitePayouts() {
    return {
      /**
       * Each cleared site, with the exchange that won it. The contract emits the winning BattleEvent and then the
       * SitePayout in one transaction (one `order`), so the battle's tile and the attacker's losses travel with the
       * payout; a payout without its battle is refused.
       */
      onSitePayout: (callback: (value: SitePayoutSystemUpdate) => void) => {
        let lastBattle: { order: string; defenderId: number; coord: Fields; troopsLost: number } | undefined;
        const stopBattles = this.setup.store.subscribeEvents((event) => {
          const battle = event.model === "BattleEvent" ? fields(event.value) : undefined;
          if (!battle || integer(battle.game_id) !== configManager.getActiveGameId()) return;
          const attacker = fields(battle.attacker);
          const coord = fields(battle.coord);
          if (!attacker || !coord) throw new Error("Malformed battle");
          lastBattle = {
            order: String(battle.order),
            defenderId: integer(battle.defender_id),
            coord,
            troopsLost: divideByPrecision(Number(BigInt(String(attacker.before)) - BigInt(String(attacker.after)))),
          };
        });
        const stopPayouts = this.onStory("SitePayout", (payload, event) => {
          const siteId = integer(payload.site_id);
          const battle = lastBattle;
          if (battle?.order !== String(event.order) || battle.defenderId !== siteId)
            throw new Error(`Site payout ${siteId} arrived without its winning battle`);
          const kind = siteKind(payload.kind);
          const reward = siteReward(payload.reward);
          if ((kind === "FallenRealm") !== (reward === null))
            throw new Error(`A cleared ${kind} pays ${kind === "FallenRealm" ? "its chest" : "a resource"}`);
          callback({
            explorerId: integer(payload.explorer_id),
            siteId,
            ownerAddress: event.owner === undefined || event.owner === null ? null : BigInt(String(event.owner)),
            kind,
            reward,
            coord: { x: integer(battle.coord.x), y: integer(battle.coord.y) },
            troopsLost: battle.troopsLost,
          });
        });
        return () => {
          stopBattles();
          stopPayouts();
        };
      },
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

const SITE_KINDS = ["Camp", "Rift", "FallenRealm"] as const;
const siteKind = (value: unknown): SitePayoutSystemUpdate["kind"] => {
  const kind = typeof value === "string" ? value : Object.keys(fields(value) ?? {})[0];
  if (!SITE_KINDS.includes(kind as SitePayoutSystemUpdate["kind"])) throw new Error("Malformed site kind");
  return kind as SitePayoutSystemUpdate["kind"];
};
/** A camp or rift pays a resource; a fallen realm pays none (its closed chest waits on the tile). */
const siteReward = (value: unknown): SitePayoutSystemUpdate["reward"] => {
  if (value === null) return null;
  const reward = fields(value);
  if (!reward) throw new Error("Malformed site reward");
  return {
    resourceId: integer(reward.resource_type) as ResourcesIds,
    amount: divideByPrecision(Number(reward.amount)),
  };
};

const ATTRIBUTES = ["Battle", "Logistics", "Scouting", "Support"] as const;
const isAttribute = (value: unknown): value is AttributeChosenSystemUpdate["attribute"] =>
  ATTRIBUTES.includes(value as AttributeChosenSystemUpdate["attribute"]);
