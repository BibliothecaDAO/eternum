import { getInternalAddressName } from "@bibliothecadao/eternum";
import { shortString } from "starknet";
import { API_BASE_URL, QUERIES } from "../../services/api";

export interface GuildMemberData {
  guildId: string;
  playerName: string;
  guildName: string;
}

export class GuildMemberStore {
  private static instance: GuildMemberStore;
  private data: Map<string, GuildMemberData> = new Map();
  private isLoading: boolean = false;
  private lastFetchTime: number = 0;
  private readonly REFRESH_INTERVAL: number;
  private readonly MAX_RETRIES = 3;
  private retryCount: number = 0;

  private constructor(refreshInterval: number) {
    this.REFRESH_INTERVAL = refreshInterval;
  }

  public static getInstance(refreshInterval: number): GuildMemberStore {
    if (!GuildMemberStore.instance) {
      GuildMemberStore.instance = new GuildMemberStore(refreshInterval);
    }
    return GuildMemberStore.instance;
  }

  public async initialize(): Promise<void> {
    if (this.isLoading) return;

    try {
      this.isLoading = true;
      await this.fetchData();
      this.retryCount = 0;
    } catch (error) {
      console.error("Failed to initialize guild member store:", error);
      if (this.retryCount < this.MAX_RETRIES) {
        this.retryCount++;
        setTimeout(() => this.initialize(), 1000 * this.retryCount);
      }
    } finally {
      this.isLoading = false;
    }
  }

  private async fetchData(): Promise<void> {
    const url = `${API_BASE_URL}?query=${encodeURIComponent(QUERIES.BASIC_PLAYER_DETAILS)}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch guild members: ${response.statusText}`);
    }

    const result = await response.json();

    // Update the data map
    for (const member of result) {
      const key = BigInt(member.player_address).toString();
      let playerName = getInternalAddressName(member.player_address);
      if (!playerName) {
        playerName = member.player_name ? shortString.decodeShortString(member.player_name.toString()) : "";
      }

      this.data.set(key, {
        guildId: member.guild_id,
        playerName: playerName,
        guildName: member.guild_name ? shortString.decodeShortString(member.guild_name.toString()) : "",
      });
    }

    this.lastFetchTime = Date.now();
  }

  public async getMemberData(address: string | bigint): Promise<GuildMemberData | undefined> {
    const key = BigInt(address).toString();

    // Check if we need to refresh the data
    if (Date.now() - this.lastFetchTime > this.REFRESH_INTERVAL) {
      await this.initialize();
    }

    return this.data.get(key);
  }

  public async getPlayerName(address: string | bigint): Promise<string> {
    const data = await this.getMemberData(address);
    return data?.playerName || "";
  }

  public async getGuildName(address: string | bigint): Promise<string> {
    const data = await this.getMemberData(address);
    return data?.guildName || "";
  }

  public clear(): void {
    this.data.clear();
    this.lastFetchTime = 0;
  }
}
