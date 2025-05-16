import { ID } from "@bibliothecadao/types";
import { API_BASE_URL, QUERIES } from "../../services/api";

export interface StructureOwnerData {
  owner: string;
}

export class StructureOwnerStore {
  private static instance: StructureOwnerStore;
  private data: Map<string, StructureOwnerData> = new Map();
  private isLoading: boolean = false;
  private lastFetchTime: number = 0;
  private readonly REFRESH_INTERVAL: number;
  private readonly MAX_RETRIES = 3;
  private retryCount: number = 0;

  private constructor(refreshInterval: number) {
    this.REFRESH_INTERVAL = refreshInterval;
  }

  public static getInstance(refreshInterval: number): StructureOwnerStore {
    if (!StructureOwnerStore.instance) {
      StructureOwnerStore.instance = new StructureOwnerStore(refreshInterval);
    }
    return StructureOwnerStore.instance;
  }

  public async initialize(): Promise<void> {
    if (this.isLoading) return;

    try {
      this.isLoading = true;
      await this.fetchData();
      this.retryCount = 0;
    } catch (error) {
      console.error("Failed to initialize structure owner store:", error);
      if (this.retryCount < this.MAX_RETRIES) {
        this.retryCount++;
        setTimeout(() => this.initialize(), 1000 * this.retryCount);
      }
    } finally {
      this.isLoading = false;
    }
  }

  private async fetchData(): Promise<void> {
    const url = `${API_BASE_URL}?query=${encodeURIComponent(QUERIES.STRUCTURE_OWNERS)}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch structure owners: ${response.statusText}`);
    }

    const result = await response.json();

    // Update the data map
    for (const structure of result) {
      const key = BigInt(structure.entity_id).toString();
      this.data.set(key, {
        owner: structure.owner,
      });
    }

    this.lastFetchTime = Date.now();
  }

  public async getOwnerData(entityId: ID | bigint): Promise<StructureOwnerData | undefined> {
    const key = BigInt(entityId).toString();

    // Check if we need to refresh the data
    if (Date.now() - this.lastFetchTime > this.REFRESH_INTERVAL) {
      await this.initialize();
    }

    return this.data.get(key);
  }

  public async getOwner(entityId: ID | bigint): Promise<string> {
    const data = await this.getOwnerData(entityId);
    return data?.owner || "";
  }

  public clear(): void {
    this.data.clear();
    this.lastFetchTime = 0;
  }
}
