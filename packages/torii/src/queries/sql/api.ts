import { ContractAddress, ID, ResourcesIds, StructureType } from "@bibliothecadao/types";

import {
  BattleLogEvent,
  EventType,
  Hyperstructure,
  PlayersData,
  PlayerStructure,
  RawRealmVillageSlot,
  RealmVillageSlot,
  StructureDetails,
  StructureLocation,
  SwapEventResponse,
  Tile,
  TokenTransfer,
  TradeEvent,
} from "../../types/sql";
import { buildApiUrl, fetchWithErrorHandling, formatAddressForQuery } from "../../utils/sql";
import { BATTLE_QUERIES } from "./battle";
import { STRUCTURE_QUERIES } from "./structure";
import { TILES_QUERIES } from "./tiles";
import { TRADING_QUERIES } from "./trading";

export class SqlApi {
  constructor(private readonly baseUrl: string) {}

  /**
   * Fetches all settlement structures from the API
   * @returns Promise resolving to an array of structure locations
   * @throws Error if API is not configured or request fails
   */
  async fetchRealmSettlements(): Promise<StructureLocation[]> {
    const url = buildApiUrl(this.baseUrl, STRUCTURE_QUERIES.REALM_SETTLEMENTS);
    return fetchWithErrorHandling<StructureLocation[]>(url, "Failed to fetch settlements");
  }

  /**
   * Fetch structures by owner from the API
   */
  async fetchStructuresByOwner(owner: string): Promise<StructureLocation[]> {
    const formattedOwner = formatAddressForQuery(owner);
    const query = STRUCTURE_QUERIES.STRUCTURES_BY_OWNER.replace("{owner}", formattedOwner);
    const url = buildApiUrl(this.baseUrl, query);
    return fetchWithErrorHandling<StructureLocation[]>(url, "Failed to fetch structures by owner");
  }

  /**
   * Fetch village slots from the API
   */
  async fetchRealmVillageSlots(): Promise<RealmVillageSlot[]> {
    const url = buildApiUrl(this.baseUrl, STRUCTURE_QUERIES.REALM_VILLAGE_SLOTS);
    const rawData = await fetchWithErrorHandling<RawRealmVillageSlot[]>(url, "Failed to fetch village slots");

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
   * Fetch token transfers for a specific contract and recipient from the API
   */
  async fetchTokenTransfers(contractAddress: string, recipientAddress: string): Promise<TokenTransfer[]> {
    const query = TRADING_QUERIES.TOKEN_TRANSFERS.replace("{contractAddress}", contractAddress.toString()).replace(
      "{recipientAddress}",
      recipientAddress.toString(),
    );

    const url = buildApiUrl(this.baseUrl, query);
    return fetchWithErrorHandling<TokenTransfer[]>(url, "Failed to fetch token transfers");
  }

  /**
   * Fetch structure details for a specific coordinate from the API
   */
  async fetchStructureByCoord(coordX: number, coordY: number): Promise<StructureDetails[]> {
    const query = STRUCTURE_QUERIES.STRUCTURE_BY_COORD.replace("{coord_x}", coordX.toString()).replace(
      "{coord_y}",
      coordY.toString(),
    );

    const url = buildApiUrl(this.baseUrl, query);
    return fetchWithErrorHandling<StructureDetails[]>(url, "Failed to fetch structure details");
  }

  /**
   * Fetch global structure explorer and guild details from the API
   */
  async fetchGlobalStructureExplorerAndGuildDetails(): Promise<PlayersData[]> {
    const url = buildApiUrl(this.baseUrl, STRUCTURE_QUERIES.STRUCTURE_AND_EXPLORER_DETAILS);
    return fetchWithErrorHandling<PlayersData[]>(url, "Failed to fetch structure explorer and guild details");
  }

  /**
   * Fetch all tiles on the map from the API
   */
  async fetchAllTiles(): Promise<Tile[]> {
    const url = buildApiUrl(this.baseUrl, TILES_QUERIES.ALL_TILES);
    return fetchWithErrorHandling<Tile[]>(url, "Failed to fetch tiles");
  }

  /**
   * Fetch all hyperstructures from the API
   */
  async fetchHyperstructures(): Promise<Hyperstructure[]> {
    const url = buildApiUrl(this.baseUrl, STRUCTURE_QUERIES.HYPERSTRUCTURES);
    return fetchWithErrorHandling<Hyperstructure[]>(url, "Failed to fetch hyperstructures");
  }

  /**
   * Fetch other structures (not owned by the specified owner)
   */
  async fetchOtherStructures(
    owner: string,
  ): Promise<{ entityId: ID; owner: ContractAddress; category: StructureType; realmId: number }[]> {
    const formattedOwner = formatAddressForQuery(owner);
    const query = STRUCTURE_QUERIES.OTHER_STRUCTURES.replace("{owner}", formattedOwner);
    const url = buildApiUrl(this.baseUrl, query);
    return fetchWithErrorHandling<{ entityId: ID; owner: ContractAddress; category: StructureType; realmId: number }[]>(
      url,
      "Failed to fetch other structures",
    );
  }

  /**
   * Fetch swap events from the API and transform them into TradeEvents
   */
  async fetchSwapEvents(userEntityIds: ID[]): Promise<TradeEvent[]> {
    const url = buildApiUrl(this.baseUrl, TRADING_QUERIES.SWAP_EVENTS);
    const events = await fetchWithErrorHandling<SwapEventResponse[]>(url, "Failed to fetch swap events");

    return events.map((event) => {
      const isBuy = event.buy === 1;
      const lordsAmount = BigInt(event.lords_amount);
      const resourceAmount = BigInt(event.resource_amount);

      return {
        type: EventType.SWAP,
        event: {
          takerId: event.entity_id,
          makerId: 0, // For swap events, there's no maker
          makerAddress: 0n,
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
  }

  /**
   * Fetch explorer address owner
   */
  async fetchExplorerAddressOwner(entityId: ID): Promise<ContractAddress | null> {
    const query = BATTLE_QUERIES.EXPLORER_ADDRESS_OWNER.replace("{entityId}", entityId.toString());
    const url = buildApiUrl(this.baseUrl, query);
    const data = await fetchWithErrorHandling<Array<{ address_owner: ContractAddress }>>(
      url,
      "Failed to fetch explorer address owner",
    );

    if (data.length === 0) {
      return null;
    }
    return data[0].address_owner;
  }

  /**
   * Fetch battle logs
   */
  async fetchBattleLogs(afterTimestamp?: string): Promise<BattleLogEvent[]> {
    const whereClause = afterTimestamp ? `WHERE timestamp > '${afterTimestamp}'` : "";
    const query = BATTLE_QUERIES.BATTLE_LOGS.replaceAll("{whereClause}", whereClause);
    const url = buildApiUrl(this.baseUrl, query);
    return fetchWithErrorHandling<BattleLogEvent[]>(url, "Failed to fetch battle logs");
  }

  /**
   * Fetch player structures with coordinates, category, and resources_packed from the API
   */
  async fetchPlayerStructures(owner: string): Promise<PlayerStructure[]> {
    const formattedOwner = formatAddressForQuery(owner);
    const query = STRUCTURE_QUERIES.PLAYER_STRUCTURES.replace("{owner}", formattedOwner);
    const url = buildApiUrl(this.baseUrl, query);
    return fetchWithErrorHandling<PlayerStructure[]>(url, "Failed to fetch player structures");
  }
}
