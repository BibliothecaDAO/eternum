import { aspects, isSeasonGame, type AspectId } from "@bibliothecadao/types";
import type {
  HeraldAspectRoster,
  HeraldAspectRosterMember,
  HeraldGameDirectory,
  HeraldGameDirectoryEntry,
  HeraldGameSnapshot,
  HeraldGameStats,
  HeraldGameStatus,
  HeraldHistoryPage,
  HeraldSnapshotModel,
} from "../../../../packages/core/src/sync/herald-http-types";
import environments from "../../../../deploy/first/environments.json";
import devRelease from "../../../../deploy/release/dev.json";
import productionRelease from "../../../../deploy/release/production.json";
import { HISTORY_PAGE_LIMIT, ROSTER_PAGE_LIMIT } from "../../../herald/src/http-limits";
import { isDevEnvironment } from "../../../game/src/shell/frame/environment";
import { ASPECT_HEX } from "../../../game/src/tokens";
import { aspectMeaning, type IconMeaning } from "../../../game/src/ui/design-system/icon-meaning";

const DASHBOARD_CACHE_HOURS = 1;
export const DASHBOARD_CACHE_TTL_MS = DASHBOARD_CACHE_HOURS * 60 * 60 * 1000;
const CACHE_KEY_PREFIX = "realms-docs-dashboard-v1:";
const TOP_MEMBERS_PER_ASPECT = 3;

export interface DashboardAspectMeta {
  id: AspectId;
  name: string;
  icon: IconMeaning;
  color: string;
}

export function dashboardOriginsFor(environment: string | undefined) {
  const dev = isDevEnvironment(environment);
  const release = dev ? devRelease : productionRelease;
  const env = dev ? environments.dev : environments.production;
  return {
    heraldUrl: release.public_herald_url,
    rpcUrl: release.public_rpc_url,
    identityOrigin: env.origin,
  };
}

const buildEnvironment =
  import.meta.env?.VITE_PUBLIC_ENVIRONMENT ??
  (typeof process !== "undefined" ? process.env.VITE_PUBLIC_ENVIRONMENT : undefined);

const origins = dashboardOriginsFor(buildEnvironment);

export const DASHBOARD_CONFIG = {
  heraldUrl: origins.heraldUrl,
  rpcUrl: origins.rpcUrl,
  identityOrigin: origins.identityOrigin,
  cacheHours: DASHBOARD_CACHE_HOURS,
  aspects: aspects.map(
    (aspect): DashboardAspectMeta => ({
      id: aspect.id,
      name: aspect.name,
      icon: aspectMeaning(aspect.id),
      color: ASPECT_HEX[aspect.id],
    }),
  ),
} as const;

export interface ChartPoint {
  key: string;
  label: string;
  value: number;
}

export interface AspectStandingRow {
  id: number;
  name: string;
  icon: IconMeaning;
  color: string;
  height: number;
  finishHeight: number;
  members: number;
  gloryTotal: string;
}

export interface TopGloryRow {
  aspectId: number;
  aspectName: string;
  aspectIcon: IconMeaning;
  rank: number;
  owner: string;
  displayName: string;
  realmId: number;
  glory: string;
}

export interface DashboardSnapshot {
  fetchedAt: number;
  confirmedBlock: number;
  latestBlock: number | null;
  latestBlockTxs: number | null;
  gameId: number;
  gameName: string;
  status: string;
  dayIndex: number | null;
  seasonDays: number | null;
  players: number;
  realms: number;
  signedInAccounts: number | null;
  seals: number;
  activeToday: number;
  playerActionsTotal: number | null;
  tilesExplored: number;
  battles: number;
  realmsCreatedTotal: number;
  totalArmies: number;
  expeditionArmies: number;
  deepArmies: number;
  deepSites: number;
  activeWorldBanes: number;
  aspectStandings: AspectStandingRow[];
  activityByDay: ChartPoint[];
  realmsByUtcDay: ChartPoint[];
  actionsByUtcDay: ChartPoint[];
  topGlory: TopGloryRow[];
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const STATUS_ORDER: Record<HeraldGameStatus, number> = {
  Live: 0,
  Registration: 1,
  Created: 2,
  Ended: 3,
  Settled: 4,
};

export function pickDefaultGame(games: readonly HeraldGameDirectoryEntry[]): HeraldGameDirectoryEntry | null {
  if (games.length === 0) return null;
  const sorted = [...games].sort((a, b) => {
    const aSeason = isSeasonGame(a.name) ? 0 : 1;
    const bSeason = isSeasonGame(b.name) ? 0 : 1;
    if (aSeason !== bSeason) return aSeason - bSeason;
    const statusDelta = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (statusDelta !== 0) return statusDelta;
    return b.game_id - a.game_id;
  });
  return sorted[0] ?? null;
}

export function formatShortAddress(address: string): string {
  const clean = address.trim();
  if (clean.length <= 12) return clean;
  return `${clean.slice(0, 6)}…${clean.slice(-4)}`;
}

export function formatUtcStamp(epochMs: number): string {
  const date = new Date(epochMs);
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm} UTC`;
}

export function formatShortUtcDay(isoDay: string): string {
  const date = new Date(`${isoDay}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return isoDay;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function readCachedDashboard(
  storage: StorageLike | null,
  gameId: number,
  now = Date.now(),
): DashboardSnapshot | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(`${CACHE_KEY_PREFIX}${gameId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DashboardSnapshot;
    if (!parsed || typeof parsed.fetchedAt !== "number") return null;
    if (now - parsed.fetchedAt >= DASHBOARD_CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeCachedDashboard(storage: StorageLike | null, gameId: number, data: DashboardSnapshot): void {
  if (!storage) return;
  try {
    storage.setItem(`${CACHE_KEY_PREFIX}${gameId}`, JSON.stringify(data));
  } catch {}
}

const toInt = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.length > 0) return Number(BigInt(value));
  return 0;
};

export function aggregateActivityByDay(rows: readonly { value: Record<string, unknown> }[]): ChartPoint[] {
  const byDay = new Map<number, number>();
  for (const row of rows) {
    const day = toInt(row.value.day);
    const active = toInt(row.value.active);
    byDay.set(day, (byDay.get(day) ?? 0) + active);
  }
  return [...byDay.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([day, value]) => ({
      key: String(day),
      label: `Day ${day + 1}`,
      value,
    }));
}

export function aggregateRealmsByUtcDay(items: readonly { value?: Record<string, unknown> }[]): ChartPoint[] {
  const byDay = new Map<string, number>();
  for (const item of items) {
    const ts = item.value?.timestamp;
    if (ts === undefined || ts === null) continue;
    const seconds = toInt(ts);
    if (seconds <= 0) continue;
    const isoDay = new Date(seconds * 1000).toISOString().slice(0, 10);
    byDay.set(isoDay, (byDay.get(isoDay) ?? 0) + 1);
  }
  return [...byDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, value]) => ({
      key: day,
      label: formatShortUtcDay(day),
      value,
    }));
}

export function summarizeSnapshot(models: readonly HeraldSnapshotModel[], currentDayIndex: number | null) {
  const rowsOf = (name: string) => models.find((entry) => entry.model === name)?.rows ?? [];
  const activityByDay = aggregateActivityByDay(rowsOf("AspectActivity"));
  const totalArmies = rowsOf("ExplorerTroops").length;
  const deepArmies = rowsOf("DeepArmy").length;
  const expeditionArmies = Math.max(0, totalArmies - deepArmies);
  const deepSites = rowsOf("DeepSite").length;
  const seals = rowsOf("Seal").length;
  const worldBaneRows = rowsOf("WorldBane");
  const activeWorldBanes =
    currentDayIndex === null
      ? 0
      : worldBaneRows.filter((row) => toInt(row.value.day) === currentDayIndex && toInt(row.value.kind) > 0).length;
  const activeToday =
    currentDayIndex === null
      ? (activityByDay.at(-1)?.value ?? 0)
      : (activityByDay.find((entry) => entry.key === String(currentDayIndex))?.value ?? 0);
  return {
    activityByDay,
    activeToday,
    totalArmies,
    expeditionArmies,
    deepArmies,
    deepSites,
    seals,
    activeWorldBanes,
  };
}

async function fetchJsonOrNull<T>(fetcher: FetchLike, url: string, init?: RequestInit): Promise<T | null> {
  try {
    const response = await fetcher(url, init);
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export async function loadDirectory(fetcher: FetchLike = fetch): Promise<HeraldGameDirectory> {
  const response = await fetcher(`${DASHBOARD_CONFIG.heraldUrl}/games`);
  if (!response.ok) throw new Error("Failed to read Herald game directory");
  return (await response.json()) as HeraldGameDirectory;
}

async function fetchAllRosterMembers(
  fetcher: FetchLike,
  gameId: number,
  aspectId: AspectId,
): Promise<HeraldAspectRosterMember[]> {
  const all: HeraldAspectRosterMember[] = [];
  for (let offset = 0; ; offset += ROSTER_PAGE_LIMIT) {
    const page = await fetchJsonOrNull<HeraldAspectRoster>(
      fetcher,
      `${DASHBOARD_CONFIG.heraldUrl}/games/${gameId}/aspects/${aspectId}/members?limit=${ROSTER_PAGE_LIMIT}&offset=${offset}`,
    );
    if (!page || !Array.isArray(page.members)) break;
    all.push(...page.members);
    const step = page.limit || ROSTER_PAGE_LIMIT;
    const total = page.total ?? all.length;
    if (offset + step >= total || page.members.length === 0) break;
  }
  return all;
}

async function fetchAllRealmHistory(
  fetcher: FetchLike,
  gameId: number,
): Promise<{ total: number; items: HeraldHistoryPage["items"] }> {
  const items: HeraldHistoryPage["items"] = [];
  let total = 0;
  for (let offset = 0; ; offset += HISTORY_PAGE_LIMIT) {
    const page = await fetchJsonOrNull<HeraldHistoryPage>(
      fetcher,
      `${DASHBOARD_CONFIG.heraldUrl}/games/${gameId}/history?model=StoryEvent&story=RealmCreatedStory&limit=${HISTORY_PAGE_LIMIT}&offset=${offset}`,
    );
    if (!page || !Array.isArray(page.items)) break;
    if (typeof page.total === "number") total = page.total;
    items.push(...page.items);
    const step = page.limit || HISTORY_PAGE_LIMIT;
    if (offset + step >= total || page.items.length === 0) break;
  }
  return { total, items };
}

export async function loadDashboardData(
  game: HeraldGameDirectoryEntry,
  confirmedBlock: number,
  fetcher: FetchLike = fetch,
  now = Date.now(),
): Promise<DashboardSnapshot> {
  const gameId = game.game_id;
  const snapshotModels = "AspectActivity,ExplorerTroops,DeepArmy,DeepSite,Seal,WorldBane";

  const [stats, accounts, snapshot, realmsHistory, exploreHistory, battleHistory, rpcBlock, ...rosters] =
    await Promise.all([
      fetchJsonOrNull<HeraldGameStats>(fetcher, `${DASHBOARD_CONFIG.heraldUrl}/games/${gameId}/stats`),
      fetchJsonOrNull<{ accounts?: number }>(fetcher, `${DASHBOARD_CONFIG.identityOrigin}/api/stats/accounts`),
      fetchJsonOrNull<HeraldGameSnapshot>(
        fetcher,
        `${DASHBOARD_CONFIG.heraldUrl}/games/${gameId}/snapshot?models=${snapshotModels}`,
      ),
      fetchAllRealmHistory(fetcher, gameId),
      fetchJsonOrNull<HeraldHistoryPage>(
        fetcher,
        `${DASHBOARD_CONFIG.heraldUrl}/games/${gameId}/history?model=StoryEvent&story=ExplorationReward&limit=1&offset=0`,
      ),
      fetchJsonOrNull<HeraldHistoryPage>(
        fetcher,
        `${DASHBOARD_CONFIG.heraldUrl}/games/${gameId}/history?model=BattleEvent&limit=1&offset=0`,
      ),
      fetchJsonOrNull<{ result?: { block_number?: number; transactions?: unknown[] } }>(
        fetcher,
        DASHBOARD_CONFIG.rpcUrl,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "starknet_getBlockWithTxHashes",
            params: ["latest"],
          }),
        },
      ),
      ...DASHBOARD_CONFIG.aspects.map((aspect) => fetchAllRosterMembers(fetcher, gameId, aspect.id)),
    ]);

  const currentDay = game.day_index ?? null;
  const snapSummary = summarizeSnapshot(snapshot?.models ?? [], currentDay);
  const finishHeight = game.aspect_race?.finish_height ?? 0;
  const seasonDays = game.aspect_race?.season_days ?? null;

  const rawTopEntries: { aspect: DashboardAspectMeta; member: HeraldAspectRosterMember }[] = [];
  const aspectStandings: AspectStandingRow[] = DASHBOARD_CONFIG.aspects.map((aspect, index) => {
    const members = rosters[index] ?? [];
    const gloryTotal = members.reduce((sum, member) => sum + BigInt(member.glory || "0"), 0n);
    for (const member of members.slice(0, TOP_MEMBERS_PER_ASPECT)) {
      rawTopEntries.push({ aspect, member });
    }
    return {
      id: aspect.id,
      name: aspect.name,
      icon: aspect.icon,
      color: aspect.color,
      height: game.aspect_race?.heights[aspect.id] ?? 0,
      finishHeight,
      members: game.aspect_members?.[aspect.id] ?? members.length,
      gloryTotal: gloryTotal.toString(),
    };
  });

  const uniqueOwners = [...new Set(rawTopEntries.map(({ member }) => member.owner))];
  const profileResponse =
    uniqueOwners.length > 0
      ? await fetchJsonOrNull<{ profiles?: Record<string, { name?: string }> }>(
          fetcher,
          `${DASHBOARD_CONFIG.identityOrigin}/api/profiles?accounts=${encodeURIComponent(uniqueOwners.join(","))}`,
        )
      : null;
  const profiles = profileResponse?.profiles ?? {};

  const topGlory: TopGloryRow[] = rawTopEntries.map(({ aspect, member }) => ({
    aspectId: aspect.id,
    aspectName: aspect.name,
    aspectIcon: aspect.icon,
    rank: member.rank,
    owner: member.owner,
    displayName: profiles[member.owner]?.name?.trim() || formatShortAddress(member.owner),
    realmId: member.realm_id,
    glory: member.glory,
  }));

  const actionsByUtcDay: ChartPoint[] = (stats?.transactions.days ?? []).map((entry) => ({
    key: entry.day,
    label: formatShortUtcDay(entry.day),
    value: entry.transactions,
  }));

  return {
    fetchedAt: now,
    confirmedBlock: snapshot?.confirmed_block ?? confirmedBlock,
    latestBlock: rpcBlock?.result?.block_number ?? null,
    latestBlockTxs: rpcBlock?.result?.transactions?.length ?? null,
    gameId,
    gameName: game.name,
    status: game.status,
    dayIndex: currentDay,
    seasonDays,
    players: stats?.players ?? game.player_count,
    realms: stats?.realms ?? game.settled_realms_count,
    signedInAccounts: typeof accounts?.accounts === "number" ? accounts.accounts : null,
    seals: snapSummary.seals,
    activeToday: snapSummary.activeToday,
    playerActionsTotal: stats ? stats.transactions.total : null,
    tilesExplored: exploreHistory?.total ?? 0,
    battles: battleHistory?.total ?? 0,
    realmsCreatedTotal: realmsHistory.total || game.settled_realms_count,
    totalArmies: snapSummary.totalArmies,
    expeditionArmies: snapSummary.expeditionArmies,
    deepArmies: snapSummary.deepArmies,
    deepSites: snapSummary.deepSites,
    activeWorldBanes: snapSummary.activeWorldBanes,
    aspectStandings,
    activityByDay: snapSummary.activityByDay,
    realmsByUtcDay: aggregateRealmsByUtcDay(realmsHistory.items),
    actionsByUtcDay,
    topGlory,
  };
}
