import { API_BASE_URL, QUERIES } from "../../services/api";

export interface ExplorerOwnerData {
  ownerAddress: string;
}

export class ExplorerOwnerStore {
  private static instance: ExplorerOwnerStore;
  private data: Map<string, ExplorerOwnerData> = new Map();
  private isLoading: boolean = false;
  private lastFetchTime: number = 0;
  private readonly REFRESH_INTERVAL: number;
  private readonly MAX_RETRIES = 3;
  private retryCount: number = 0;

  private constructor(refreshInterval: number) {
    this.REFRESH_INTERVAL = refreshInterval;
  }

  public static getInstance(refreshInterval: number): ExplorerOwnerStore {
    if (!ExplorerOwnerStore.instance) {
      ExplorerOwnerStore.instance = new ExplorerOwnerStore(refreshInterval);
    }
    return ExplorerOwnerStore.instance;
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
    const url = `${API_BASE_URL}?query=${encodeURIComponent(QUERIES.EXPLORER_OWNERS)}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch structure owners: ${response.statusText}`);
    }

    const result = await response.json();

    // Update the data map
    for (const explorer of result) {
      const key = explorer.explorer_id.toString();
      this.data.set(key, {
        ownerAddress: explorer.owner_address,
      });
    }

    this.lastFetchTime = Date.now();
  }

  public async getExplorerOwnerData(explorerId: string): Promise<ExplorerOwnerData | undefined> {
    const key = explorerId;

    // Check if we need to refresh the data
    if (Date.now() - this.lastFetchTime > this.REFRESH_INTERVAL) {
      await this.initialize();
    }

    return this.data.get(key);
  }

  public async getOwnerAddress(explorerId: string): Promise<string> {
    const data = await this.getExplorerOwnerData(explorerId);
    return data?.ownerAddress || "";
  }

  public clear(): void {
    this.data.clear();
    this.lastFetchTime = 0;
  }
}
