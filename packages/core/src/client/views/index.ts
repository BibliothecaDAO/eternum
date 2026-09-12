import type {
  ArmyInfo,
  Building,
  ClientComponents,
  ContractAddress,
  GuildMemberInfo,
  ID,
  RealmInfo,
  ResourceArrivalInfo,
  Structure,
} from "@bibliothecadao/types";
import { type Entity, type QueryFragment, runQuery } from "@dojoengine/recs";

import type { ResourceManager } from "../../managers/resource-manager";
import type { StaminaManager } from "../../managers/stamina-manager";
import type { GameClient } from "../game-client";
import { explorersByStructureQuery, readExplorers, readStaminaManager } from "./armies";
import {
  guildMembersQuery,
  guildWhitelistQuery,
  playerWhitelistQuery,
  readGuildMembers,
  readGuildWhitelist,
} from "./guilds";
import { type MarketView, openTradesQuery, readMarket, readOpenTrades } from "./market";
import { arrivalsByStructureQuery, readResourceArrivals, readResourceManager } from "./resources";
import {
  allRealmsQuery,
  buildingsAtQuery,
  type HyperstructureRow,
  hyperstructuresByOwnerQuery,
  hyperstructureUpdatesQuery,
  readBuildings,
  readHyperstructureUpdates,
  readRealmInfos,
  readStructureIds,
  readStructureRows,
  readStructures,
  realmsByOwnerQuery,
  type StructureRow,
  structuresByOwnerQuery,
  villagesByOwnerQuery,
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
  buildings(outerCol: number, outerRow: number): Building[];
  resources(entityId: ID): ResourceManager;
  resourceArrivals(structureEntityId: ID): ResourceArrivalInfo[];
  guildMembers(guildEntityId: ContractAddress): GuildMemberInfo[];
  guildWhitelist(guildEntityId: ContractAddress): GuildMemberInfo[];
  playerWhitelist(playerAddress: ContractAddress): GuildMemberInfo[];
  market(owner: ContractAddress, currentBlockTimestamp: number): MarketView;
}

/**
 * Each view runs a hook's query once and maps it with the hook's reader, so a fact is computed in one place.
 * The viewer is the address the game is seen from: the hooks pass the connected account, and isMine, isHome, and
 * isUser are relative to it.
 */
export const createGameViews = (client: GameClient, viewer: ContractAddress): GameViews => {
  const components = client.setup.components;
  const query = (fragments: QueryFragment[]): Entity[] => [...runQuery(fragments)];

  return {
    explorers: (structureEntityId) =>
      readExplorers(components, query(explorersByStructureQuery(components, structureEntityId)), viewer),
    stamina: (armyEntityId) => readStaminaManager(components, armyEntityId),
    structures: (owner) => readStructures(components, query(structuresByOwnerQuery(components, owner)), viewer),
    realms: (owner) => readRealmInfos(components, query(realmsByOwnerQuery(components, owner))),
    villages: (owner) => readRealmInfos(components, query(villagesByOwnerQuery(components, owner))),
    allRealms: () => readStructureRows(components, query(allRealmsQuery(components))),
    hyperstructureIds: (owner) => readStructureIds(components, query(hyperstructuresByOwnerQuery(components, owner))),
    hyperstructureUpdates: (hyperstructureEntityId) =>
      readHyperstructureUpdates(components, query(hyperstructureUpdatesQuery(components, hyperstructureEntityId))),
    buildings: (outerCol, outerRow) =>
      readBuildings(components, query(buildingsAtQuery(components, outerCol, outerRow))),
    resources: (entityId) => readResourceManager(components, entityId),
    resourceArrivals: (structureEntityId) =>
      readResourceArrivals(components, query(arrivalsByStructureQuery(components, structureEntityId))),
    guildMembers: (guildEntityId) =>
      readGuildMembers(components, query(guildMembersQuery(components, guildEntityId)), viewer),
    guildWhitelist: (guildEntityId) =>
      readGuildWhitelist(components, query(guildWhitelistQuery(components, guildEntityId))),
    playerWhitelist: (playerAddress) =>
      readGuildWhitelist(components, query(playerWhitelistQuery(components, playerAddress))),
    market: (owner, currentBlockTimestamp) =>
      readMarket(
        readOpenTrades(components, query(openTradesQuery(components)), currentBlockTimestamp),
        playerStructureEntities(components, owner),
      ),
  };
};

/** The realms and villages a player can make trades from. */
const playerStructureEntities = (components: ClientComponents, owner: ContractAddress): Entity[] => [
  ...runQuery(realmsByOwnerQuery(components, owner)),
  ...runQuery(villagesByOwnerQuery(components, owner)),
];
