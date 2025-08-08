/**
 * MapDataStore - A singleton data manager for fetching and caching all map entities
 *
 * This store fetches and caches information about all structures and armies on the map,
 * providing detailed information including:
 *
 * For Structures:
 * - Guard armies (amount, tier, type)
 * - Active productions (resource type, number of buildings)
 * - Structure level, type, and owner information
 *
 * For Armies:
 * - Troop type (crossbowman, paladin, knight)
 * - Tier (1, 2, 3)
 * - Current stamina and troop count
 * - Owner information
 *
 * Usage:
 * const mapStore = MapDataStore.getInstance(5 * 60 * 1000); // 5-minute refresh
 * const allData = mapStore.getAllMapEntities();
 * const structure = mapStore.getStructureById(123);
 * const army = mapStore.getArmyById(456);
 */

import { sqlApi } from "@/services/api";
import { getIsBlitz } from "@/ui/constants";
import { divideByPrecision, getStructureTypeName, unpackBuildingCounts } from "@bibliothecadao/eternum";
import { StructureMapDataRaw } from "@bibliothecadao/torii";
import { BuildingType, StructureType, TroopTier } from "@bibliothecadao/types";
import { shortString } from "starknet";
import realms from "../../../../../public/jsons/realms.json";

// Army category mapping
const ARMY_CATEGORY_NAMES: Record<string, string> = {
  "1": "Knight",
  "2": "Crossbowman",
  "3": "Paladin",
};

export const TROOP_TIERS: Record<string, number> = {
  T1: 1,
  T2: 2,
  T3: 3,
};

export interface GuardArmy {
  slot: number;
  category: string | null; // troop type (crossbowman, paladin, knight)
  tier: number; // 1, 2, 3
  count: number;
  stamina: number;
}

export interface ActiveProduction {
  buildingCount: number;
  buildingType: BuildingType;
}

export interface StructureMapData {
  entityId: number;
  coordX: number;
  coordY: number;
  structureType: StructureType;
  structureTypeName: string;
  level: number;
  ownerAddress: string;
  ownerName: string;
  guardArmies: GuardArmy[];
  activeProductions: ActiveProduction[];
  realmId?: number;
}

export interface ArmyMapData {
  entityId: number;
  coordX: number;
  coordY: number;
  category: string | null; // troop type (crossbowman, paladin, knight)
  tier: TroopTier;
  count: number;
  stamina: {
    amount: bigint;
    updated_tick: bigint;
  };
  ownerAddress: string;
  ownerName: string;
}

export class MapDataStore {
  private static instance: MapDataStore;
  private structuresMap: Map<number, StructureMapData> = new Map();
  private armiesMap: Map<number, ArmyMapData> = new Map();
  private addressToNameMap: Map<string, string> = new Map();
  private isLoading: boolean = false;
  private lastFetchTime: number = 0;
  private readonly REFRESH_INTERVAL: number;
  private readonly MAX_RETRIES = 3;
  private retryCount: number = 0;
  private refreshTimer: NodeJS.Timeout | null = null;
  private refreshCallbacks: Array<() => void> = [];
  private loadingPromise: Promise<void> | null = null;

  private hexToBigInt(hex: string | null): bigint {
    if (!hex || hex === "0x0") return 0n;
    return BigInt(hex);
  }

  private parseActiveProductions(
    packedCounts1: string | null,
    packedCounts2: string | null,
    packedCounts3: string | null,
  ): ActiveProduction[] {
    try {
      if (!packedCounts1 && !packedCounts2 && !packedCounts3) return [];

      // Convert hex strings to bigints
      const packedValues: bigint[] = [
        packedCounts1 ? this.hexToBigInt(packedCounts1) : 0n,
        packedCounts2 ? this.hexToBigInt(packedCounts2) : 0n,
        packedCounts3 ? this.hexToBigInt(packedCounts3) : 0n,
      ];

      // Unpack the building counts
      const buildingCounts = unpackBuildingCounts(packedValues);

      const productions: ActiveProduction[] = [];

      // Iterate through all building types and create productions for non-zero counts
      for (let buildingType = 1; buildingType <= buildingCounts.length; buildingType++) {
        const count = buildingCounts[buildingType - 1]; // buildingCounts is 0-indexed, buildingType is 1-indexed

        if (count > 0) {
          productions.push({
            buildingCount: count,
            buildingType: buildingType as BuildingType,
          });
        }
      }

      return productions;
    } catch (error) {
      console.warn("Failed to parse active productions from packed counts:", error);
      return [];
    }
  }

  private getCategoryName(category: string | null): string | null {
    if (!category) return null;
    return ARMY_CATEGORY_NAMES[category] || category;
  }

  private parseGuardArmies(structure: StructureMapDataRaw): GuardArmy[] {
    const guards: GuardArmy[] = [];

    // Parse delta guard (slot 0)
    if (structure.delta_count && this.hexToBigInt(structure.delta_count) > 0n) {
      guards.push({
        slot: 0,
        category: this.getCategoryName(structure.delta_category),
        tier: structure.delta_tier ? TROOP_TIERS[structure.delta_tier] : 1,
        count: divideByPrecision(Number(this.hexToBigInt(structure.delta_count))),
        stamina: Number(this.hexToBigInt(structure.delta_stamina_amount)),
      });
    }

    // Parse charlie guard (slot 1)
    if (structure.charlie_count && this.hexToBigInt(structure.charlie_count) > 0n) {
      guards.push({
        slot: 1,
        category: this.getCategoryName(structure.charlie_category),
        tier: structure.charlie_tier ? TROOP_TIERS[structure.charlie_tier] : 1,
        count: divideByPrecision(Number(this.hexToBigInt(structure.charlie_count))),
        stamina: Number(this.hexToBigInt(structure.charlie_stamina_amount)),
      });
    }

    // Parse bravo guard (slot 2)
    if (structure.bravo_count && this.hexToBigInt(structure.bravo_count) > 0n) {
      guards.push({
        slot: 2,
        category: this.getCategoryName(structure.bravo_category),
        tier: structure.bravo_tier ? TROOP_TIERS[structure.bravo_tier] : 1,
        count: divideByPrecision(Number(this.hexToBigInt(structure.bravo_count))),
        stamina: Number(this.hexToBigInt(structure.bravo_stamina_amount)),
      });
    }

    // Parse alpha guard (slot 3)
    if (structure.alpha_count && this.hexToBigInt(structure.alpha_count) > 0n) {
      guards.push({
        slot: 3,
        category: this.getCategoryName(structure.alpha_category),
        tier: structure.alpha_tier ? TROOP_TIERS[structure.alpha_tier] : 1,
        count: divideByPrecision(Number(this.hexToBigInt(structure.alpha_count))),
        stamina: Number(this.hexToBigInt(structure.alpha_stamina_amount)),
      });
    }

    return guards;
  }

  private constructor(refreshInterval: number) {
    this.REFRESH_INTERVAL = refreshInterval;
  }

  public static getInstance(refreshInterval: number): MapDataStore {
    if (!MapDataStore.instance) {
      console.log("MapDataStore: Creating new instance with refresh interval", refreshInterval);
      MapDataStore.instance = new MapDataStore(refreshInterval);
    }
    return MapDataStore.instance;
  }

  /**
   * Start automatic refresh timer
   */
  public startAutoRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }

    console.log(`MapDataStore: Starting automatic refresh every ${this.REFRESH_INTERVAL / 1000} seconds`);

    this.refreshTimer = setInterval(() => {
      this.refresh().catch((error) => {
        console.error("MapDataStore automatic refresh failed:", error);
      });
    }, this.REFRESH_INTERVAL);
  }

  /**
   * Stop automatic refresh timer
   */
  public stopAutoRefresh(): void {
    if (this.refreshTimer) {
      console.log("MapDataStore: Stopping automatic refresh");
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /**
   * Register a callback to be called when data is refreshed
   */
  public onRefresh(callback: () => void): void {
    this.refreshCallbacks.push(callback);
  }

  /**
   * Remove a refresh callback
   */
  public offRefresh(callback: () => void): void {
    const index = this.refreshCallbacks.indexOf(callback);
    if (index > -1) {
      this.refreshCallbacks.splice(index, 1);
    }
  }

  /**
   * Notify all registered callbacks that data has been refreshed
   */
  private notifyRefreshCallbacks(): void {
    this.refreshCallbacks.forEach((callback) => {
      try {
        callback();
      } catch (error) {
        console.error("Error in refresh callback:", error);
      }
    });
  }

  public async refresh(): Promise<void> {
    console.log("Refreshing map data store");
    if (this.isLoading) {
      // If already loading, return the existing promise
      if (this.loadingPromise) {
        return this.loadingPromise;
      }
      return;
    }

    try {
      this.isLoading = true;
      this.loadingPromise = this.fetchAndStoreMapData();
      await this.loadingPromise;
      console.log("Map data store refreshed at ", new Date().toISOString());
      this.retryCount = 0;

      // Notify all registered callbacks that data has been refreshed
      this.notifyRefreshCallbacks();
    } catch (error) {
      console.error("Failed to refresh map data store:", error);
      if (this.retryCount < this.MAX_RETRIES) {
        this.retryCount++;
        setTimeout(() => this.refresh(), 1000 * this.retryCount);
      }
    } finally {
      this.isLoading = false;
      this.loadingPromise = null;
    }
  }

  private async fetchAndStoreMapData(): Promise<void> {
    const isBlitz = getIsBlitz();
    const realmsData = realms as Record<string, { name: string }>;

    // Fetch all structures and armies in parallel
    const [structuresRaw, armiesRaw] = await Promise.all([
      sqlApi.fetchAllStructuresMapData(),
      sqlApi.fetchAllArmiesMapData(),
    ]);

    // Transform and store structures
    structuresRaw.forEach((structure) => {
      const guardArmies = this.parseGuardArmies(structure);

      const activeProductions = this.parseActiveProductions(
        structure.packed_counts_1,
        structure.packed_counts_2,
        structure.packed_counts_3,
      );

      const ownerName = structure.owner_name
        ? BigInt(structure.owner_name) === 0n
          ? ""
          : shortString.decodeShortString(BigInt(structure.owner_name).toString())
        : "";

      const structureTypeName =
        structure.realm_id && structure.realm_id !== 0
          ? realmsData[structure.realm_id.toString()]?.name || "Unknown Realm"
          : getStructureTypeName(structure.structure_type, isBlitz);

      const structureData: StructureMapData = {
        entityId: structure.entity_id,
        coordX: structure.coord_x,
        coordY: structure.coord_y,
        structureType: structure.structure_type as StructureType,
        structureTypeName,
        level: structure.level,
        ownerAddress: BigInt(structure.owner_address).toString(),
        ownerName,
        guardArmies,
        activeProductions,
        realmId: structure.realm_id || undefined,
      };

      this.structuresMap.set(structure.entity_id, structureData);
      this.addressToNameMap.set(structureData.ownerAddress, ownerName);
    });

    // Transform and store armies
    armiesRaw.forEach((army) => {
      const ownerName = army.owner_name
        ? BigInt(army.owner_name) === 0n
          ? ""
          : shortString.decodeShortString(BigInt(army.owner_name).toString())
        : "";

      const armyData: ArmyMapData = {
        entityId: army.entity_id,
        coordX: army.coord_x,
        coordY: army.coord_y,
        category: this.getCategoryName(army.category),
        tier: army.tier as TroopTier,
        count: divideByPrecision(Number(this.hexToBigInt(army.count))),
        stamina: {
          amount: this.hexToBigInt(army.stamina_amount),
          updated_tick: this.hexToBigInt(army.stamina_updated_tick),
        },
        ownerAddress: army.owner_address ? BigInt(army.owner_address).toString() : "",
        ownerName,
      };

      this.armiesMap.set(army.entity_id, armyData);
      this.addressToNameMap.set(armyData.ownerAddress, ownerName);
    });

    this.lastFetchTime = Date.now();
  }

  private _checkRefresh(): void {
    if (Date.now() - this.lastFetchTime > this.REFRESH_INTERVAL) {
      this.refresh();
    }
  }

  public getStructureById(entityId: number): StructureMapData | undefined {
    this._checkRefresh();
    return this.structuresMap.get(entityId);
  }

  public async getStructureByIdAsync(entityId: number): Promise<StructureMapData | undefined> {
    await this.waitForData();
    return this.structuresMap.get(entityId);
  }

  public getArmyById(entityId: number): ArmyMapData | undefined {
    this._checkRefresh();
    return this.armiesMap.get(entityId);
  }

  public async getArmyByIdAsync(entityId: number): Promise<ArmyMapData | undefined> {
    await this.waitForData();
    return this.armiesMap.get(entityId);
  }

  public getAllStructures(): StructureMapData[] {
    this._checkRefresh();
    return Array.from(this.structuresMap.values());
  }

  public getAllArmies(): ArmyMapData[] {
    this._checkRefresh();
    return Array.from(this.armiesMap.values());
  }

  public getAllMapEntities(): { structures: StructureMapData[]; armies: ArmyMapData[] } {
    this._checkRefresh();
    return {
      structures: this.getAllStructures(),
      armies: this.getAllArmies(),
    };
  }

  public getStructuresByOwner(ownerAddress: string): StructureMapData[] {
    this._checkRefresh();
    const normalizedAddress = BigInt(ownerAddress).toString();
    return Array.from(this.structuresMap.values()).filter((structure) => structure.ownerAddress === normalizedAddress);
  }

  public getArmiesByOwner(ownerAddress: string): ArmyMapData[] {
    this._checkRefresh();
    const normalizedAddress = BigInt(ownerAddress).toString();
    return Array.from(this.armiesMap.values()).filter((army) => army.ownerAddress === normalizedAddress);
  }

  public getEntitiesInRadius(
    centerX: number,
    centerY: number,
    radius: number,
  ): { structures: StructureMapData[]; armies: ArmyMapData[] } {
    this._checkRefresh();
    const radiusSquared = radius * radius;

    const structures = Array.from(this.structuresMap.values()).filter((structure) => {
      const dx = structure.coordX - centerX;
      const dy = structure.coordY - centerY;
      return dx * dx + dy * dy <= radiusSquared;
    });

    const armies = Array.from(this.armiesMap.values()).filter((army) => {
      const dx = army.coordX - centerX;
      const dy = army.coordY - centerY;
      return dx * dx + dy * dy <= radiusSquared;
    });

    return { structures, armies };
  }

  public getPlayerName(ownerAddress: string): string {
    const normalizedAddress = BigInt(ownerAddress).toString();
    return this.addressToNameMap.get(normalizedAddress) || "";
  }

  public async getPlayerNameAsync(ownerAddress: string): Promise<string> {
    await this.waitForData();
    const normalizedAddress = BigInt(ownerAddress).toString();
    return this.addressToNameMap.get(normalizedAddress) || "";
  }

  public clear(): void {
    this.structuresMap.clear();
    this.armiesMap.clear();
    this.addressToNameMap.clear();
    this.lastFetchTime = 0;
  }

  public getStructureCount(): number {
    return this.structuresMap.size;
  }

  public getArmyCount(): number {
    return this.armiesMap.size;
  }

  /**
   * Wait for data to be loaded before proceeding
   * Returns immediately if data is already available
   */
  public async waitForData(): Promise<void> {
    // If data is already loaded and not currently loading, return immediately
    if (!this.isLoading && this.lastFetchTime > 0) {
      return;
    }

    // If currently loading, wait for the loading promise
    if (this.isLoading && this.loadingPromise) {
      await this.loadingPromise;
      return;
    }

    // If no data and not loading, trigger a refresh
    if (this.lastFetchTime === 0) {
      await this.refresh();
    }
  }

  /**
   * Clean up resources and stop automatic refresh
   */
  public destroy(): void {
    this.stopAutoRefresh();
    this.structuresMap.clear();
    this.armiesMap.clear();
    this.addressToNameMap.clear();
    console.log("MapDataStore: Destroyed and cleaned up");
  }
}
