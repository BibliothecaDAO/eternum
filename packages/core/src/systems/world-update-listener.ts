import { safeInteger } from "../utils/safe-integer";
import { BuildingType, type ID, type ResourcesIds } from "@bibliothecadao/types";
import type { GameClientSetup } from "../client/game-client";
import { configManager } from "../managers/config-manager";
import { divideByPrecision } from "../utils/utils";
import { siteKindOf } from "../utils/expeditions";
import { describeRelicChestOpening, describeRewardChestOpening } from "./story-event-formatter";
import type {
  BattleEventSystemUpdate,
  BuildingSystemUpdate,
  TierBoughtSystemUpdate,
  ExplorerRewardSystemUpdate,
  ChestOpenedSystemUpdate,
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
            if (!row || row.game_id !== configManager.getActiveGameId() || row.structure_id !== BigInt(structureId))
              continue;
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
              change.current.entity_id === BigInt(entityId)
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

  get Chests() {
    return {
      onChestOpened: (callback: (value: ChestOpenedSystemUpdate) => void) => {
        const stopRelics = this.onStory("RelicChestOpened", (payload, event) => {
          const coord = fields(payload.coord);
          if (!coord || !Array.isArray(payload.relics)) throw new Error("Malformed chest opening");
          callback({
            kind: "relics",
            title: describeRelicChestOpening(payload, this.setup.store),
            explorerId: integer(payload.explorer_id),
            hex: { x: integer(coord.x), y: integer(coord.y) },
            relics: payload.relics.map(integer) as ResourcesIds[],
            timestamp: integer(event.timestamp),
          });
        });
        const stopLords = this.onStory("RewardChestOpened", (payload, event) => {
          const coord = fields(payload.coord);
          if (!coord) throw new Error("Malformed reward chest opening");
          callback({
            kind: "lords",
            title: describeRewardChestOpening(payload, this.setup.store),
            explorerId: integer(payload.explorer_id),
            hex: { x: integer(coord.x), y: integer(coord.y) },
            amount: integer(payload.amount),
            timestamp: integer(event.timestamp),
          });
        });
        return () => {
          stopRelics();
          stopLords();
        };
      },
    };
  }

  get Attributes() {
    return {
      onTierBought: (callback: (value: TierBoughtSystemUpdate) => void) =>
        this.onStory("TierBought", (payload) => {
          const attribute =
            typeof payload.attribute === "string" ? payload.attribute : Object.keys(fields(payload.attribute) ?? {})[0];
          if (!isAttribute(attribute)) throw new Error("Malformed tier purchase");
          callback({
            explorerId: integer(payload.explorer_id),
            attribute,
            tier: integer(payload.tier),
            price: integer(payload.price),
          });
        }),
    };
  }

  get SitePayouts() {
    return {
      /**
       * Each cleared site, with the exchange that won it. The contract pays the site from inside the capture and only
       * then emits the winning BattleEvent (logic/combat.cairo), so a payout waits for the next battle, which must be
       * its own: same transaction, same site. Any other battle, or another payout, leaves it without one: refused.
       */
      onSitePayout: (callback: (value: SitePayoutSystemUpdate) => void) => {
        let waiting: { transaction: string; clear: PaidSite } | undefined;
        const takeWaiting = () => {
          const payout = waiting;
          waiting = undefined;
          return payout;
        };
        const stopPayouts = this.onStory("SitePayout", (payload, event) => {
          const unanswered = takeWaiting();
          waiting = { transaction: transactionOf(event), clear: paidSite(payload, event) };
          if (unanswered) throw new Error(`Site payout ${unanswered.clear.siteId} arrived without its winning battle`);
        });
        const stopBattles = this.setup.store.subscribeEvents((event) => {
          const battle = event.model === "BattleEvent" ? fields(event.value) : undefined;
          if (!battle || integer(battle.game_id) !== configManager.getActiveGameId()) return;
          const payout = takeWaiting();
          if (!payout) return;
          if (payout.transaction !== transactionOf(battle) || payout.clear.siteId !== integer(battle.defender_id))
            throw new Error(`Site payout ${payout.clear.siteId} arrived without its winning battle`);
          callback({ ...payout.clear, ...wonExchange(battle) });
        });
        return () => {
          stopPayouts();
          stopBattles();
        };
      },
    };
  }

  get ExplorerReward() {
    return {
      /** Each reveal's payout, a dormant spire's grant included: both tell the tile and what it paid. */
      onExplorerRewardEventUpdate: (callback: (value: ExplorerRewardSystemUpdate) => void) => {
        const report = (payload: Fields, event: Fields) => {
          const explorerId = integer(payload.explorer_id);
          const explorer = this.setup.store.get("ExplorerTroops", {
            game_id: configManager.getActiveGameId(),
            explorer_id: explorerId,
          });
          const owner = event.owner;
          callback({
            explorerId,
            explorerStructureId: explorer ? safeInteger(explorer.owner) : 0,
            explorerOwnerAddress: owner === undefined || owner === null ? null : BigInt(String(owner)),
            resourceId: integer(payload.resource_type) as ResourcesIds,
            rawAmount: BigInt(String(payload.amount)),
            amount: divideByPrecision(Number(payload.amount)),
            coord: { x: integer(fields(payload.coord)?.x), y: integer(fields(payload.coord)?.y) },
            timestamp: integer(event.timestamp),
          });
        };
        const stopReveals = this.onStory("ExplorationReward", report);
        const stopSpires = this.onStory("SpireDiscovered", report);
        return () => {
          stopReveals();
          stopSpires();
        };
      },
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

/** The transaction that emitted an event: what ties a payout to its battle on the wire. */
const transactionOf = (event: Fields): string => {
  const hash = fields(event.event_position)?.transaction_hash;
  if (typeof hash !== "string") throw new Error("Native event without its transaction");
  return hash;
};

type PaidSite = Omit<SitePayoutSystemUpdate, "coord" | "troopsLost">;

/** What a SitePayout story says by itself: who cleared which site, and what it paid. */
const paidSite = (payload: Fields, story: Fields): PaidSite => {
  const kind = siteKindOf(integer(payload.category));
  const reward = siteReward(payload.reward);
  if ((kind === "Ruin" || kind === "Beasts") !== (reward === null))
    throw new Error(`A cleared ${kind} pays ${reward === null ? "nothing" : "a resource"}`);
  return {
    explorerId: integer(payload.explorer_id),
    siteId: integer(payload.site_id),
    ownerAddress: story.owner === undefined || story.owner === null ? null : BigInt(String(story.owner)),
    kind,
    reward,
  };
};

/** What the winning battle adds: the site's tile and the whole troops the army lost taking it. */
const wonExchange = (battle: Fields): Pick<SitePayoutSystemUpdate, "coord" | "troopsLost"> => {
  const attacker = fields(battle.attacker);
  const coord = fields(battle.coord);
  if (!attacker || !coord) throw new Error("Malformed battle");
  return {
    coord: { x: integer(coord.x), y: integer(coord.y) },
    troopsLost: divideByPrecision(Number(BigInt(String(attacker.before)) - BigInt(String(attacker.after)))),
  };
};

/** A camp or rift pays a resource; beasts pay none, and a ruin its closed chest. */
const siteReward = (value: unknown): SitePayoutSystemUpdate["reward"] => {
  if (value === null) return null;
  const reward = fields(value);
  if (!reward) throw new Error("Malformed site reward");
  return {
    resourceId: integer(reward.resource_type) as ResourcesIds,
    amount: divideByPrecision(Number(reward.amount)),
  };
};

const ATTRIBUTES = ["Battle", "Logistics", "Scouting", "Homecoming"] as const;
const isAttribute = (value: unknown): value is TierBoughtSystemUpdate["attribute"] =>
  ATTRIBUTES.includes(value as TierBoughtSystemUpdate["attribute"]);
