import {
  GameSyncRuntime,
  HeraldGameSyncTransport,
  calculateUnregisteredShareholderPoints,
  getGameSyncModelsForChannel,
  type HeraldGameSnapshot,
  type HeraldHistoryPage,
} from "@bibliothecadao/eternum/game-sync";
import { ResourcesIds, tileDataToTile, type ID } from "@bibliothecadao/types";

import type { GameReadApi } from "../views";
import { MemoryGameSyncStore } from "./memory-game-sync-store";

const RESOURCE_PRECISION = 1_000_000n;

const normalizeAddress = (value: unknown): string => {
  try {
    return `0x${BigInt(value as string | number | bigint).toString(16)}`;
  } catch {
    return "0x0";
  }
};

const sameFelt = (left: unknown, right: unknown): boolean => {
  try {
    return BigInt(left as string | number | bigint) === BigInt(right as string | number | bigint);
  } catch {
    return false;
  }
};

const record = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const buildStreamUrl = (baseUrl: string, chain: string, gameId: number): string => {
  const url = new URL(baseUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : url.protocol === "http:" ? "ws:" : url.protocol;
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/${chain}/games/${gameId}`;
  return url.toString();
};

const buildHttpUrl = (baseUrl: string, chain: string, gameId: number, suffix: string): URL => {
  const url = new URL(baseUrl);
  if (url.protocol === "ws:") url.protocol = "http:";
  if (url.protocol === "wss:") url.protocol = "https:";
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/${chain}/games/${gameId}${suffix}`;
  url.search = "";
  return url;
};

const fetchJson = async <T>(url: URL): Promise<T> => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Herald read failed: ${response.status} ${response.statusText}`);
  return response.json() as Promise<T>;
};

export class HeraldReadApi implements GameReadApi {
  private readonly runtime = new GameSyncRuntime();
  private readonly store = new MemoryGameSyncStore();

  constructor(
    private readonly baseUrl: string,
    private readonly chain: "madara" | "appchain",
    private readonly gameId: number,
  ) {}

  public async start(): Promise<void> {
    const models = getGameSyncModelsForChannel("gamewide-entity", { includeS2Only: true }).map(({ name }) => name);
    await this.runtime.startSession({
      snapshotModels: models,
      store: this.store,
      transport: new HeraldGameSyncTransport({ url: buildStreamUrl(this.baseUrl, this.chain, this.gameId) }),
    });
  }

  public close(): void {
    this.runtime.dispose();
  }

  public async fetchPlayerStructures(owner: string): Promise<any[]> {
    return this.structureRows().filter((row) => sameFelt(row.owner, owner));
  }

  public async fetchStructuresByOwner(owner: string): Promise<any[]> {
    return this.fetchPlayerStructures(owner);
  }

  public async fetchResourceBalances(entityIds: number[]): Promise<any[]> {
    return this.store.rows("Resource").filter((row) => entityIds.some((entityId) => sameFelt(row.entity_id, entityId)));
  }

  public async fetchGuardsByStructure(entityId: ID): Promise<any[]> {
    const structure = this.store.rows("Structure").find((row) => sameFelt(row.entity_id, entityId));
    return Object.entries(record(structure?.troop_guards)).map(([slot, troops]) => ({ slot, troops }));
  }

  public async fetchAllArmiesMapData(): Promise<any[]> {
    const owners = new Map(
      this.store.rows("Structure").map((row) => [String(row.entity_id), normalizeAddress(row.owner)]),
    );
    const latestBattles = await this.fetchLatestBattles();
    return this.store.rows("ExplorerTroops").map((row) => {
      const coord = record(row.coord);
      const troops = record(row.troops);
      const stamina = record(troops.stamina);
      return {
        ...row,
        entity_id: row.explorer_id,
        owner_address: owners.get(String(row.owner)) ?? normalizeAddress(row.owner),
        coord_x: coord.x,
        coord_y: coord.y,
        category: troops.category,
        tier: troops.tier,
        count: troops.count,
        stamina_amount: stamina.amount,
        battle_cooldown_end: troops.battle_cooldown_end,
        ...this.latestBattleFields(row.explorer_id, latestBattles),
      };
    });
  }

  public async fetchAllStructuresMapData(): Promise<any[]> {
    const latestBattles = await this.fetchLatestBattles();
    return this.structureRows().map((row) => ({ ...row, ...this.latestBattleFields(row.entity_id, latestBattles) }));
  }

  public async fetchAllTiles(): Promise<any[]> {
    return this.store.rows("TileOpt").flatMap((row) => {
      try {
        return [tileDataToTile(row.data as string | number | bigint)];
      } catch {
        return [];
      }
    });
  }

  public async fetchHyperstructures(): Promise<any[]> {
    return this.store.rows("Hyperstructure");
  }

  public async fetchSwapEvents(userEntityIds: ID[]): Promise<any[]> {
    const page = await this.fetchHistory({ limit: 500, model: "SwapEvent" });
    return page.items.map(({ value }) => {
      const buy = value.buy === true || value.buy === "0x1" || value.buy === 1n;
      const lordsAmount = BigInt(String(value.lords_amount));
      const resourceAmount = BigInt(String(value.resource_amount));
      const resourceType = Number(BigInt(String(value.resource_type)));
      const entityId = Number(BigInt(String(value.entity_id)));
      return {
        type: "AMM Swap",
        event: {
          takerId: entityId,
          makerId: 0,
          makerAddress: "0x0",
          takerAddress: this.ownerOfStructure(entityId),
          isYours: userEntityIds.some((id) => sameFelt(id, entityId)),
          resourceGiven: {
            resourceId: buy ? ResourcesIds.Lords : resourceType,
            amount: Number(buy ? lordsAmount : resourceAmount),
          },
          resourceTaken: {
            resourceId: buy ? resourceType : ResourcesIds.Lords,
            amount: Number(buy ? resourceAmount : lordsAmount),
          },
          eventTime: new Date(Number(BigInt(String(value.timestamp))) * 1_000),
        },
      };
    });
  }

  public async fetchPlayerLeaderboard(limit = 10, offset = 0): Promise<any[]> {
    const names = new Map(this.store.rows("AddressName").map((row) => [normalizeAddress(row.address), row.name]));
    const unregisteredPoints = calculateUnregisteredShareholderPoints(
      {
        gameRegistry: this.store.rows("GameRegistry"),
        hyperstructures: this.store.rows("Hyperstructure"),
        presets: this.store.rows("PresetConfig"),
        shareholders: this.store.rows("HyperstructureShareholders"),
      },
      this.gameId,
    );
    return this.store
      .rows("PlayerRegisteredPoints")
      .flatMap((row) => {
        const playerAddress = normalizeAddress(row.address);
        const registeredPointsRaw = Number(BigInt(String(row.registered_points ?? 0)));
        const unregistered = unregisteredPoints.get(playerAddress) ?? 0;
        return playerAddress === "0x0"
          ? []
          : [
              {
                playerAddress,
                playerName: names.get(playerAddress) ?? null,
                prizeClaimed: row.prize_claimed === true || row.prize_claimed === "0x1",
                registeredPoints: registeredPointsRaw,
                registeredPointsRegistered: registeredPointsRaw,
                totalPoints: registeredPointsRaw / Number(RESOURCE_PRECISION) + unregistered,
                unregisteredPoints: unregistered,
                activityBreakdown: {
                  exploration: { count: 0, points: 0 },
                  openRelicChest: { count: 0, points: 0 },
                  hyperStructureBanditsDefeat: { count: 0, points: 0 },
                  otherStructureBanditsDefeat: { count: 0, points: 0 },
                  hyperstructureShare: { count: 0, points: 0 },
                },
              },
            ];
      })
      .toSorted((left, right) => right.registeredPoints - left.registeredPoints)
      .slice(offset, offset + limit)
      .map((row, index) => ({ ...row, rank: offset + index + 1 }));
  }

  public async fetchPlayerLeaderboardByAddress(address: string): Promise<any | null> {
    return (await this.fetchPlayerLeaderboard(10_000, 0)).find((row) => sameFelt(row.playerAddress, address)) ?? null;
  }

  public async fetchStoryEvents(limit = 50, offset = 0): Promise<any[]> {
    return (await this.fetchHistory({ limit, model: "StoryEvent", offset })).items.map((event) => this.storyRow(event));
  }

  public async fetchStoryEventsByEntity(entityId: ID, limit = 50, offset = 0): Promise<any[]> {
    return (await this.fetchHistory({ entityId, limit, model: "StoryEvent", offset })).items.map((event) =>
      this.storyRow(event),
    );
  }

  public async fetchStoryEventsByOwner(owner: string, limit = 50, offset = 0): Promise<any[]> {
    return (await this.fetchHistory({ limit, model: "StoryEvent", offset, owner })).items.map((event) =>
      this.storyRow(event),
    );
  }

  public async fetchStoryEventsCount(): Promise<number> {
    return (await this.fetchHistory({ limit: 0, model: "StoryEvent" })).total;
  }

  public async fetchExplorerAddressOwner(entityId: ID): Promise<string | null> {
    const explorer = this.store.rows("ExplorerTroops").find((row) => sameFelt(row.explorer_id, entityId));
    return explorer ? this.ownerOfStructure(explorer.owner) : null;
  }

  private structureRows(): any[] {
    return this.store.rows("Structure").map((row) => {
      const base = record(row.base);
      const metadata = record(row.metadata);
      return {
        ...row,
        category: base.category,
        coord_x: base.coord_x,
        coord_y: base.coord_y,
        level: base.level,
        realm_id: metadata.realm_id,
      };
    });
  }

  private ownerOfStructure(entityId: unknown): string {
    const structure = this.store.rows("Structure").find((row) => sameFelt(row.entity_id, entityId));
    return normalizeAddress(structure?.owner);
  }

  private async fetchLatestBattles(): Promise<Map<string, Record<string, unknown>>> {
    const snapshot = await this.fetchSnapshot(["LastBattle"]);
    return new Map(snapshot.models[0]?.rows.map((row) => [String(row.value.entity_id), row.value]) ?? []);
  }

  private latestBattleFields(
    entityId: unknown,
    latestBattles: ReadonlyMap<string, Record<string, unknown>>,
  ): Record<string, unknown> {
    const latest = latestBattles.get(String(entityId));
    if (!latest) return {};
    const attacker = this.entityPosition(latest.latest_attacker_id);
    const defender = this.entityPosition(latest.latest_defender_id);
    return {
      ...latest,
      latest_attacker_coord_x: attacker?.x ?? null,
      latest_attacker_coord_y: attacker?.y ?? null,
      latest_defender_coord_x: defender?.x ?? null,
      latest_defender_coord_y: defender?.y ?? null,
    };
  }

  private entityPosition(entityId: unknown): { x: unknown; y: unknown } | null {
    if (entityId === undefined || entityId === null) return null;
    const structure = this.store.rows("Structure").find((row) => sameFelt(row.entity_id, entityId));
    if (structure) {
      const base = record(structure.base);
      return { x: base.coord_x, y: base.coord_y };
    }
    const explorer = this.store.rows("ExplorerTroops").find((row) => sameFelt(row.explorer_id, entityId));
    if (!explorer) return null;
    const coord = record(explorer.coord);
    return { x: coord.x, y: coord.y };
  }

  private async fetchSnapshot(models: readonly string[]): Promise<HeraldGameSnapshot> {
    const url = buildHttpUrl(this.baseUrl, this.chain, this.gameId, "/snapshot");
    url.searchParams.set("models", models.join(","));
    return fetchJson(url);
  }

  private async fetchHistory(input: {
    entityId?: ID;
    limit: number;
    model: string;
    offset?: number;
    owner?: string;
  }): Promise<HeraldHistoryPage> {
    const url = buildHttpUrl(this.baseUrl, this.chain, this.gameId, "/history");
    url.searchParams.set("limit", String(input.limit));
    url.searchParams.set("model", input.model);
    if (input.entityId !== undefined) url.searchParams.set("entity_id", String(input.entityId));
    if (input.offset !== undefined) url.searchParams.set("offset", String(input.offset));
    if (input.owner) url.searchParams.set("owner", input.owner);
    return fetchJson(url);
  }

  private storyRow(event: HeraldHistoryPage["items"][number]): any {
    const storyValue = record(event.value.story);
    const [eventType, data] = Object.entries(storyValue)[0] ?? ["unknown", {}];
    return {
      ...event.value,
      event_id: `${event.transaction_hash}:${event.event_index}`,
      event_type: eventType,
      type: eventType,
      data,
      involved_entities: [event.value.entity_id].filter((value) => value !== null && value !== undefined),
    };
  }
}
