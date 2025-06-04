import { ContractAddress, ID, ResourcesIds, StructureType } from "@bibliothecadao/types";

import {
  BattleLogEvent,
  EventType,
  Hyperstructure,
  PlayersData,
  PlayerStructure,
  QuestTileData,
  RawRealmVillageSlot,
  RealmVillageSlot,
  SeasonEnded,
  StructureDetails,
  StructureLocation,
  SwapEventResponse,
  Tile,
  TokenTransfer,
  TradeEvent,
} from "../../types/sql";
import { buildApiUrl, extractFirstOrNull, fetchWithErrorHandling, formatAddressForQuery } from "../../utils/sql";
import { BATTLE_QUERIES } from "./battle";
import { QUEST_QUERIES } from "./quest";
import { SEASON_QUERIES } from "./season";
import { STRUCTURE_QUERIES } from "./structure";
import { TILES_QUERIES } from "./tiles";
import { TRADING_QUERIES } from "./trading";

export class SqlApi {
  constructor(private readonly baseUrl: string) {}

  /**
   * Fetches quest data by entity ID from the SQL database.
   * SQL queries always return arrays, so we extract the first result.
   */
  async fetchQuest(entityId: ID): Promise<QuestTileData | null> {
    const query = QUEST_QUERIES.QUEST_BY_ENTITY_ID.replace("{entityId}", entityId.toString());
    const url = buildApiUrl(this.baseUrl, query);
    const results = await fetchWithErrorHandling<QuestTileData>(url, "Failed to fetch quest");
    return extractFirstOrNull(results);
  }

  /**
   * Fetches the first structure from the SQL database.
   * SQL queries always return arrays, so we extract the first result.
   */
  async fetchFirstStructure(): Promise<StructureDetails | null> {
    const url = buildApiUrl(this.baseUrl, STRUCTURE_QUERIES.FIRST_STRUCTURE);
    const results = await fetchWithErrorHandling<StructureDetails>(url, "Failed to fetch first structure");
    return extractFirstOrNull(results);
  }

  /**
   * Fetches surrounding wonder bonus by coordinates and radius.
   * SQL queries always return arrays, so we extract the first result.
   */
  async fetchSurroundingWonderBonus(radius: number, coords: { col: number; row: number }): Promise<ID | null> {
    const query = STRUCTURE_QUERIES.SURROUNDING_WONDER_BONUS.replace("{minX}", (coords.col - radius).toString())
      .replace("{maxX}", (coords.col + radius).toString())
      .replace("{minY}", (coords.row - radius).toString())
      .replace("{maxY}", (coords.row + radius).toString());
    const url = buildApiUrl(this.baseUrl, query);
    const results = await fetchWithErrorHandling<ID>(url, "Failed to fetch surrounding wonder bonus");
    return extractFirstOrNull(results);
  }

  /**
   * Fetches tiles by their coordinates from the SQL database.
   * SQL queries always return arrays.
   */
  async fetchTilesByCoords(coordsList: { col: number; row: number }[]): Promise<Tile[]> {
    const query = TILES_QUERIES.TILES_BY_COORDS.replace(
      "{coords}",
      coordsList.map((coord) => `(${coord.col},${coord.row})`).join(","),
    );
    const url = buildApiUrl(this.baseUrl, query);
    return await fetchWithErrorHandling<Tile>(url, "Failed to fetch tiles by coords");
  }

  /**
   * Fetches all settlement structures from the SQL database.
   * SQL queries always return arrays.
   * @returns Promise resolving to an array of structure locations
   * @throws Error if API is not configured or request fails
   */
  async fetchRealmSettlements(): Promise<StructureLocation[]> {
    const url = buildApiUrl(this.baseUrl, STRUCTURE_QUERIES.REALM_SETTLEMENTS);
    return await fetchWithErrorHandling<StructureLocation>(url, "Failed to fetch settlements");
  }

  /**
   * Fetch structures by owner from the SQL database.
   * SQL queries always return arrays.
   */
  async fetchStructuresByOwner(owner: string): Promise<StructureLocation[]> {
    const formattedOwner = formatAddressForQuery(owner);
    const query = STRUCTURE_QUERIES.STRUCTURES_BY_OWNER.replace("{owner}", formattedOwner);
    const url = buildApiUrl(this.baseUrl, query);
    return await fetchWithErrorHandling<StructureLocation>(url, "Failed to fetch structures by owner");
  }

  /**
   * Fetch village slots from the SQL database.
   * SQL queries always return arrays. We then transform the raw data.
   */
  async fetchRealmVillageSlots(): Promise<RealmVillageSlot[]> {
    const url = buildApiUrl(this.baseUrl, STRUCTURE_QUERIES.REALM_VILLAGE_SLOTS);
    const rawData = await fetchWithErrorHandling<RawRealmVillageSlot>(url, "Failed to fetch village slots");

    // Parse the directions_left string for each item
    return rawData.map((item) => ({
      connected_realm_coord: {
        col: item["connected_realm_coord.x"],
        row: item["connected_realm_coord.y"],
      },
      connected_realm_entity_id: item.connected_realm_entity_id,
      connected_realm_id: item.connected_realm_id,
      directions_left: JSON.parse(item.directions_left || "[]"),
    }));
  }

  /**
   * Fetch token transfers for a specific contract and recipient from the SQL database.
   * SQL queries always return arrays.
   */
  async fetchTokenTransfers(contractAddress: string, recipientAddress: string): Promise<TokenTransfer[]> {
    const query = TRADING_QUERIES.TOKEN_TRANSFERS.replace("{contractAddress}", contractAddress.toString()).replace(
      "{recipientAddress}",
      recipientAddress.toString(),
    );

    const url = buildApiUrl(this.baseUrl, query);
    return await fetchWithErrorHandling<TokenTransfer>(url, "Failed to fetch token transfers");
  }

  /**
   * Fetch structure details for a specific coordinate from the SQL database.
   * SQL queries always return arrays, so we extract the first result.
   */
  async fetchStructureByCoord(coordX: number, coordY: number): Promise<StructureDetails | null> {
    const query = STRUCTURE_QUERIES.STRUCTURE_BY_COORD.replace("{coord_x}", coordX.toString()).replace(
      "{coord_y}",
      coordY.toString(),
    );

    const url = buildApiUrl(this.baseUrl, query);
    const results = await fetchWithErrorHandling<StructureDetails>(url, "Failed to fetch structure details");
    return extractFirstOrNull(results);
  }

  /**
   * Fetch global structure explorer and guild details from the SQL database.
   * SQL queries always return arrays.
   */
  async fetchGlobalStructureExplorerAndGuildDetails(): Promise<PlayersData[]> {
    const url = buildApiUrl(this.baseUrl, STRUCTURE_QUERIES.STRUCTURE_AND_EXPLORER_DETAILS);
    return await fetchWithErrorHandling<PlayersData>(url, "Failed to fetch structure explorer and guild details");
  }

  /**
   * Fetch all tiles on the map from the SQL database.
   * SQL queries always return arrays.
   */
  async fetchAllTiles(): Promise<Tile[]> {
    const url = buildApiUrl(this.baseUrl, TILES_QUERIES.ALL_TILES);
    return await fetchWithErrorHandling<Tile>(url, "Failed to fetch tiles");
  }

  /**
   * Fetch all hyperstructures from the SQL database.
   * SQL queries always return arrays.
   */
  async fetchHyperstructures(): Promise<Hyperstructure[]> {
    const url = buildApiUrl(this.baseUrl, STRUCTURE_QUERIES.HYPERSTRUCTURES);
    return await fetchWithErrorHandling<Hyperstructure>(url, "Failed to fetch hyperstructures");
  }

  /**
   * Fetch other structures (not owned by the specified owner) from the SQL database.
   * SQL queries always return arrays.
   */
  async fetchOtherStructures(
    owner: string,
  ): Promise<{ entityId: ID; owner: ContractAddress; category: StructureType; realmId: number }[]> {
    const formattedOwner = formatAddressForQuery(owner);
    const query = STRUCTURE_QUERIES.OTHER_STRUCTURES.replace("{owner}", formattedOwner);
    const url = buildApiUrl(this.baseUrl, query);
    return await fetchWithErrorHandling<{
      entityId: ID;
      owner: ContractAddress;
      category: StructureType;
      realmId: number;
    }>(url, "Failed to fetch other structures");
  }

  /**
   * Fetch swap events from the SQL database and transform them into TradeEvents.
   * SQL queries always return arrays.
   */
  async fetchSwapEvents(userEntityIds: ID[]): Promise<TradeEvent[]> {
    const url = buildApiUrl(this.baseUrl, TRADING_QUERIES.SWAP_EVENTS);
    const events = await fetchWithErrorHandling<SwapEventResponse>(url, "Failed to fetch swap events");

    const res = events.map((event) => {
      const isBuy = event.buy === 1;
      const lordsAmount = BigInt(event.lords_amount);
      const resourceAmount = BigInt(event.resource_amount);

      return {
        type: EventType.SWAP,
        event: {
          takerId: event.entity_id,
          makerId: 0, // For swap events, there's no maker
          makerAddress: "0x0",
          takerAddress: event.owner,
          isYours: userEntityIds.includes(event.entity_id),
          resourceGiven: {
            resourceId: isBuy ? ResourcesIds.Lords : event.resource_type,
            amount: Number(isBuy ? lordsAmount : resourceAmount),
          },
          resourceTaken: {
            resourceId: isBuy ? event.resource_type : ResourcesIds.Lords,
            amount: Number(isBuy ? resourceAmount : lordsAmount),
          },
          eventTime: new Date(Number(event.timestamp) * 1000),
        },
      };
    });
    return res;
  }

  /**
   * Fetch explorer address owner from the SQL database.
   * SQL queries always return arrays, so we extract the first result.
   */
  async fetchExplorerAddressOwner(entityId: ID): Promise<ContractAddress | null> {
    const query = BATTLE_QUERIES.EXPLORER_ADDRESS_OWNER.replace("{entityId}", entityId.toString());
    const url = buildApiUrl(this.baseUrl, query);
    const results = await fetchWithErrorHandling<{ address_owner: ContractAddress }>(
      url,
      "Failed to fetch explorer address owner",
    );

    const firstResult = extractFirstOrNull(results);
    return firstResult?.address_owner ?? null;
  }

  /**
   * Fetch battle logs from the SQL database.
   * SQL queries always return arrays.
   */
  async fetchBattleLogs(afterTimestamp?: string): Promise<BattleLogEvent[]> {
    const whereClause = afterTimestamp ? `WHERE timestamp > '${afterTimestamp}'` : "";
    const query = BATTLE_QUERIES.BATTLE_LOGS.replaceAll("{whereClause}", whereClause);
    const url = buildApiUrl(this.baseUrl, query);
    return await fetchWithErrorHandling<BattleLogEvent>(url, "Failed to fetch battle logs");
  }

  /**
   * Fetch player structures with coordinates, category, and resources_packed from the SQL database.
   * SQL queries always return arrays.
   */
  async fetchPlayerStructures(owner: string): Promise<PlayerStructure[]> {
    const formattedOwner = formatAddressForQuery(owner);
    const query = STRUCTURE_QUERIES.PLAYER_STRUCTURES.replace("{owner}", formattedOwner);
    const url = buildApiUrl(this.baseUrl, query);
    return await fetchWithErrorHandling<PlayerStructure>(url, "Failed to fetch player structures");
  }

  /**
   * Fetch season ended info from the SQL database.
   * SQL queries always return arrays, so we extract the first result.
   */
  async fetchSeasonEnded(): Promise<SeasonEnded | null> {
    const url = buildApiUrl(this.baseUrl, SEASON_QUERIES.SEASON_ENDED);
    const results = await fetchWithErrorHandling<SeasonEnded>(url, "Failed to fetch season ended");
    return extractFirstOrNull(results);
  }
}
