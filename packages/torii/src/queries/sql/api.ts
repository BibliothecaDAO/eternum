import { ContractAddress, Coord, EntityType, ID, ResourcesIds, StructureType } from "@bibliothecadao/types";

import { extractRelicsFromResourceData } from ".";
import {
  ArmyRelicsData,
  BattleLogEvent,
  ChestInfo,
  ChestTile,
  EntityRelicEffect,
  EntityWithRelics,
  EventType,
  Guard,
  GuardData,
  Hyperstructure,
  PlayerRelicsData,
  PlayersData,
  PlayerStructure,
  QuestTileData,
  RawRealmVillageSlot,
  RealmVillageSlot,
  SeasonEnded,
  StructureDetails,
  StructureLocation,
  StructureRelicsData,
  SwapEventResponse,
  Tile,
  TokenTransfer,
  TradeEvent,
} from "../../types/sql";
import {
  buildApiUrl,
  extractFirstOrNull,
  fetchWithErrorHandling,
  formatAddressForQuery,
  hexToBigInt,
} from "../../utils/sql";
import { BATTLE_QUERIES } from "./battle";
import { QUEST_QUERIES } from "./quest";
import { RELICS_QUERIES } from "./relics";
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

  /**
   * Fetch guards by structure entity ID from the SQL database.
   * SQL queries always return arrays, so we extract the first result and transform it.
   */
  async fetchGuardsByStructure(entityId: ID): Promise<Guard[]> {
    const query = STRUCTURE_QUERIES.GUARDS_BY_STRUCTURE.replace("{entityId}", entityId.toString());
    const url = buildApiUrl(this.baseUrl, query);
    const results = await fetchWithErrorHandling<GuardData>(url, "Failed to fetch guards by structure");

    const guardData = extractFirstOrNull(results);
    if (!guardData) return [];

    // Transform the flat SQL result into structured Guard objects
    const guards: Guard[] = [
      {
        slot: 0,
        troops:
          guardData.delta_count && hexToBigInt(guardData.delta_count) > 0n
            ? {
                category: guardData.delta_category,
                tier: guardData.delta_tier,
                count: hexToBigInt(guardData.delta_count),
                stamina: {
                  amount: hexToBigInt(guardData.delta_stamina_amount),
                  updated_tick: hexToBigInt(guardData.delta_stamina_updated_tick),
                },
              }
            : null,
        destroyedTick: hexToBigInt(guardData.delta_destroyed_tick),
        cooldownEnd: 0, // Will be calculated by the client
      },
      {
        slot: 1,
        troops:
          guardData.charlie_count && hexToBigInt(guardData.charlie_count) > 0n
            ? {
                category: guardData.charlie_category,
                tier: guardData.charlie_tier,
                count: hexToBigInt(guardData.charlie_count),
                stamina: {
                  amount: hexToBigInt(guardData.charlie_stamina_amount),
                  updated_tick: hexToBigInt(guardData.charlie_stamina_updated_tick),
                },
              }
            : null,
        destroyedTick: hexToBigInt(guardData.charlie_destroyed_tick),
        cooldownEnd: 0, // Will be calculated by the client
      },
      {
        slot: 2,
        troops:
          guardData.bravo_count && hexToBigInt(guardData.bravo_count) > 0n
            ? {
                category: guardData.bravo_category,
                tier: guardData.bravo_tier,
                count: hexToBigInt(guardData.bravo_count),
                stamina: {
                  amount: hexToBigInt(guardData.bravo_stamina_amount),
                  updated_tick: hexToBigInt(guardData.bravo_stamina_updated_tick),
                },
              }
            : null,
        destroyedTick: hexToBigInt(guardData.bravo_destroyed_tick),
        cooldownEnd: 0, // Will be calculated by the client
      },
      {
        slot: 3,
        troops:
          guardData.alpha_count && hexToBigInt(guardData.alpha_count) > 0n
            ? {
                category: guardData.alpha_category,
                tier: guardData.alpha_tier,
                count: hexToBigInt(guardData.alpha_count),
                stamina: {
                  amount: hexToBigInt(guardData.alpha_stamina_amount),
                  updated_tick: hexToBigInt(guardData.alpha_stamina_updated_tick),
                },
              }
            : null,
        destroyedTick: hexToBigInt(guardData.alpha_destroyed_tick),
        cooldownEnd: 0, // Will be calculated by the client
      },
    ];

    return guards;
  }

  /**
   * Fetch chest tiles near a given position from the SQL database.
   * SQL queries always return arrays.
   */
  async fetchChestsNearPosition(center: { x: number; y: number }, radius: number): Promise<ChestInfo[]> {
    const query = RELICS_QUERIES.CHESTS_NEAR_POSITION.replace("{minX}", (center.x - radius).toString())
      .replace("{maxX}", (center.x + radius).toString())
      .replace("{minY}", (center.y - radius).toString())
      .replace("{maxY}", (center.y + radius).toString());
    const url = buildApiUrl(this.baseUrl, query);
    const chestTiles = await fetchWithErrorHandling<ChestTile>(url, "Failed to fetch nearby chests");

    const centerCoord = new Coord(center.x, center.y);

    return chestTiles
      .map((chest) => {
        const chestCoord = new Coord(chest.col, chest.row);
        const distance = centerCoord.distance(chestCoord);

        return {
          entityId: chest.entity_id,
          position: { x: chest.col, y: chest.row },
          distance: distance,
        };
      })
      .sort((a, b) => a.distance - b.distance);
  }

  /**
   * Fetch all relics owned by a player's structures from the SQL database.
   * SQL queries always return arrays.
   */
  async fetchPlayerStructureRelics(owner: string): Promise<StructureRelicsData[]> {
    const formattedOwner = formatAddressForQuery(owner);
    const query = RELICS_QUERIES.PLAYER_STRUCTURE_RELICS.replace("{owner}", formattedOwner);
    const url = buildApiUrl(this.baseUrl, query);
    return await fetchWithErrorHandling<StructureRelicsData>(url, "Failed to fetch player structure relics");
  }

  /**
   * Fetch all relics owned by a player's armies from the SQL database.
   * SQL queries always return arrays.
   */
  async fetchPlayerArmyRelics(owner: string): Promise<ArmyRelicsData[]> {
    const formattedOwner = formatAddressForQuery(owner);
    const query = RELICS_QUERIES.PLAYER_ARMY_RELICS.replace("{owner}", formattedOwner);
    const url = buildApiUrl(this.baseUrl, query);
    return await fetchWithErrorHandling<ArmyRelicsData>(url, "Failed to fetch player army relics");
  }

  /**
   * Get all relics owned by a player across all their entities
   * @param sqlApi - The SQL API instance
   * @param playerAddress - The player's contract address
   * @returns All relics grouped by entity type
   */
  async fetchAllPlayerRelics(playerAddress: string): Promise<PlayerRelicsData> {
    try {
      const [structureRelics, armyRelics] = await Promise.all([
        this.fetchPlayerStructureRelics(playerAddress),
        this.fetchPlayerArmyRelics(playerAddress),
      ]);

      const structures: EntityWithRelics[] = structureRelics.map((structure) => {
        const relics = extractRelicsFromResourceData(structure);

        return {
          entityId: structure.entity_id,
          structureType: structure.entity_type,
          type: EntityType.STRUCTURE,
          position: { x: structure.coord_x, y: structure.coord_y },
          relics,
        };
      });

      const armies: EntityWithRelics[] = armyRelics.map((army) => {
        const relics = extractRelicsFromResourceData(army);

        return {
          entityId: army.entity_id,
          type: EntityType.ARMY,
          position: { x: army.coord_x, y: army.coord_y },
          relics,
        };
      });

      return {
        structures,
        armies,
      };
    } catch (error) {
      console.error("Error fetching player relics:", error);
      return {
        structures: [],
        armies: [],
      };
    }
  }

  async fetchEntityRelicEffects(entityId: ID): Promise<EntityRelicEffect[]> {
    const query = RELICS_QUERIES.ENTITY_RELIC_EFFECTS.replace("{entityId}", entityId.toString());
    const url = buildApiUrl(this.baseUrl, query);
    return await fetchWithErrorHandling<EntityRelicEffect>(url, "Failed to fetch entity relic effects");
  }
}
