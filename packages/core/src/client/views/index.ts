import type {
  ArmyInfo,
  Building,
  ContractAddress,
  GuildMemberInfo,
  ID,
  RealmInfo,
  ResourceArrivalInfo,
  Structure,
} from "@bibliothecadao/types";
import { StructureType } from "@bibliothecadao/types";
import type { ResourceManager } from "../../managers/resource-manager";
import type { StaminaManager } from "../../managers/stamina-manager";
import type { GameClient } from "../game-client";
import type { PlayerNameResolver } from "../../utils/entities";
import { readExplorers, readStaminaManager } from "./armies";
import { readGuildMembers, readGuildWhitelist } from "./guilds";
import { type MarketView, readMarket, readOpenTrades } from "./market";
import { readResourceArrivals, readResourceManager } from "./resources";
import {
  type BuildingTiles,
  type HyperstructureRow,
  type StructureRow,
  readBuildings,
  readBuildingTiles,
  readHyperstructureUpdates,
  readRealmInfos,
  readStructureIds,
  readStructureRows,
  readStructures,
} from "./structures";
export * from "./armies";
export * from "./guilds";
export * from "./market";
export * from "./resources";
export * from "./structures";

/** One-shot reads of the game facts the React hooks subscribe to, for a caller with no render loop. */
export interface GameViews {
  explorers(structureEntityId: ID): ArmyInfo[];
  stamina(armyEntityId: ID): StaminaManager;
  structures(owner: ContractAddress): Structure[];
  realms(owner: ContractAddress): RealmInfo[];
  villages(owner: ContractAddress): RealmInfo[];
  allRealms(): StructureRow[];
  hyperstructureIds(owner: ContractAddress): ID[];
  hyperstructureUpdates(hyperstructureEntityId: ID): (HyperstructureRow | undefined)[];
  buildings(structureId: number): Building[];
  /** Occupancy, level, and the buildings standing on a structure's own slots, as the construction surfaces read them. */
  buildingTiles(structureEntityId: ID): BuildingTiles;
  resources(entityId: ID): ResourceManager;
  resourceArrivals(structureEntityId: ID): ResourceArrivalInfo[];
  guildMembers(guildEntityId: ContractAddress): GuildMemberInfo[];
  guildWhitelist(guildEntityId: ContractAddress): GuildMemberInfo[];
  playerWhitelist(playerAddress: ContractAddress): GuildMemberInfo[];
  market(owner: ContractAddress, currentBlockTimestamp: number): MarketView;
}

export const createGameViews = (
  client: GameClient,
  viewer: ContractAddress,
  playerName: PlayerNameResolver,
): GameViews => {
  const { store, systemCalls } = client.setup;
  return {
    explorers: (id) => readExplorers(store, id, viewer, playerName),
    stamina: (id) => readStaminaManager(store, id),
    structures: (owner) => readStructures(store, owner, viewer, playerName),
    realms: (owner) => readRealmInfos(store, owner, StructureType.Realm, playerName),
    villages: (owner) => readRealmInfos(store, owner, StructureType.Village, playerName),
    allRealms: () => readStructureRows(store, StructureType.Realm),
    hyperstructureIds: (owner) => readStructureIds(store, owner, StructureType.Hyperstructure),
    hyperstructureUpdates: (id) => readHyperstructureUpdates(store, id),
    buildings: (structureId) => readBuildings(store, structureId),
    buildingTiles: (id) => readBuildingTiles(store, systemCalls, id),
    resources: (id) => readResourceManager(store, id),
    resourceArrivals: (id) => readResourceArrivals(store, id),
    guildMembers: (id) => readGuildMembers(store, id, viewer, playerName),
    guildWhitelist: (id) => readGuildWhitelist(store, viewer, { guildId: id }, playerName),
    playerWhitelist: (player) => readGuildWhitelist(store, viewer, { player }, playerName),
    market: (owner, timestamp) =>
      readMarket(readOpenTrades(store, timestamp, playerName), [
        ...readStructureIds(store, owner, StructureType.Realm),
        ...readStructureIds(store, owner, StructureType.Village),
      ]),
  };
};
