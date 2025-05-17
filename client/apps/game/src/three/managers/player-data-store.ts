import { shortString } from "starknet";
import { fetchGlobalStructureExplorerAndGuildDetails } from "../../services/api";

interface PlayerDataTransformed {
  explorerIds: string[];
  structureIds: string[];
  guildId: string;
  guildName: string;
  ownerName: string;
  ownerAddress: string;
}

export class PlayerDataStore {
  private static instance: PlayerDataStore;
  private addressToPlayerDataMap: Map<string, PlayerDataTransformed> = new Map();
  private structureToAddressMap: Map<string, string> = new Map();
  private explorerToStructureMap: Map<string, string> = new Map();
  private isLoading: boolean = false;
  private lastFetchTime: number = 0;
  private readonly REFRESH_INTERVAL: number;
  private readonly MAX_RETRIES = 3;
  private retryCount: number = 0;

  private constructor(refreshInterval: number) {
    this.REFRESH_INTERVAL = refreshInterval;
  }

  public static getInstance(refreshInterval: number): PlayerDataStore {
    if (!PlayerDataStore.instance) {
      PlayerDataStore.instance = new PlayerDataStore(refreshInterval);
    }
    return PlayerDataStore.instance;
  }

  public async refresh(): Promise<void> {
    if (this.isLoading) return;

    try {
      this.isLoading = true;
      await this.fetchAndStoreData();
      console.log("Player data store refreshed at ", new Date().toISOString());
      this.retryCount = 0;
    } catch (error) {
      console.error("Failed to refresh player data store:", error);
      if (this.retryCount < this.MAX_RETRIES) {
        this.retryCount++;
        setTimeout(() => this.refresh(), 1000 * this.retryCount);
      }
    } finally {
      this.isLoading = false;
    }
  }

  private async fetchAndStoreData(): Promise<void> {
    const result = await fetchGlobalStructureExplorerAndGuildDetails();
    await Promise.all(
      result.map((item) => {
        let transformedItem = {
          explorerIds: item.explorer_ids ? item.explorer_ids.toString().split(",").filter(Boolean) : [],
          structureIds: item.structure_ids ? item.structure_ids.toString().split(",").filter(Boolean) : [],
          guildId: item.guild_id || "",
          guildName: item.guild_name ? shortString.decodeShortString(item.guild_name.toString()) : "",
          ownerAddress: BigInt(item.owner_address).toString() || "",
          ownerName: item.player_name ? shortString.decodeShortString(item.player_name.toString()) : "",
        };
        // Create a mapping from explorer id to structure id
        transformedItem.explorerIds.forEach((explorerId) => {
          let actualExplorerId = explorerId.split(":")[0];
          let actualStructureId = explorerId.split(":")[1];
          this.explorerToStructureMap.set(actualExplorerId, actualStructureId);
        });

        // Create a mapping from structure id to player address
        transformedItem.structureIds.forEach((structureId) => {
          this.structureToAddressMap.set(structureId, transformedItem.ownerAddress);
        });

        // Create a mapping from owner address to PlayerDataTransformed
        this.addressToPlayerDataMap.set(BigInt(transformedItem.ownerAddress).toString(), transformedItem);
      }),
    );

    this.lastFetchTime = Date.now();
  }

  private _checkRefresh(): void {
    if (Date.now() - this.lastFetchTime > this.REFRESH_INTERVAL) {
      this.refresh();
    }
  }

  public async getPlayerDataFromAddress(address: string): Promise<PlayerDataTransformed | undefined> {
    this._checkRefresh();
    return this.addressToPlayerDataMap.get(BigInt(address).toString());
  }

  public async getPlayerDataFromStructureId(structureId: string): Promise<PlayerDataTransformed | undefined> {
    this._checkRefresh();
    const address = this.structureToAddressMap.get(structureId);
    if (address) {
      return this.getPlayerDataFromAddress(BigInt(address).toString());
    }
    return undefined;
  }

  public async getPlayerDataFromExplorerId(explorerId: string): Promise<PlayerDataTransformed | undefined> {
    this._checkRefresh();
    const structureId = this.explorerToStructureMap.get(explorerId);
    if (structureId) {
      return this.getPlayerDataFromStructureId(structureId);
    }
    return undefined;
  }

  public async getExplorerOwnerAddress(id: string): Promise<string> {
    const data = await this.getPlayerDataFromExplorerId(id);
    return data?.ownerAddress || "";
  }

  public clear(): void {
    this.structureToAddressMap.clear();
    this.explorerToStructureMap.clear();
    this.addressToPlayerDataMap.clear();
    this.lastFetchTime = 0;
  }

  public updateStructureOwnerAddress(id: string, ownerAddress: string): void {
    this.structureToAddressMap.set(id, BigInt(ownerAddress).toString());
  }

  public updateExplorerStructure(explorerId: string, structureId: string): void {
    this.explorerToStructureMap.set(explorerId, structureId);
  }
}
