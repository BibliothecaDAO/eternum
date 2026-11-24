import { RESOURCE_PRECISION, aspects } from "@bibliothecadao/types";
import productionRelease from "../../../../deploy/release/production.json";
import {
  HISTORY_PAGE_DEFAULT,
  HISTORY_PAGE_LIMIT,
  ROSTER_PAGE_DEFAULT,
  ROSTER_PAGE_LIMIT,
  STATS_CACHE_SECONDS,
} from "../../../herald/src/http-limits";
import { aspectMeaning } from "../../../game/src/ui/design-system/icon-meaning";

export interface PublicRouteSpec {
  readonly method: "GET" | "POST";
  readonly base: "herald" | "rpc";
  readonly path: string;
  readonly params: string;
  readonly returns: string;
}

const heraldUrl = productionRelease.public_herald_url;
const rpcUrl = productionRelease.public_rpc_url;
const rpcPath = new URL(rpcUrl).pathname;
const aspectMapLiteral = `{ ${aspects.map((aspect) => `${aspect.id}: "${aspect.name}"`).join(", ")} }`;
const aspectListLine = aspects.map((aspect) => `${aspect.id} = ${aspect.name}`).join(", ");
const sampleAspectId = aspects[1].id;
const precisionText = RESOURCE_PRECISION.toLocaleString("en-US");
const statsCacheText = STATS_CACHE_SECONDS.toLocaleString("en-US");

export const SNAPSHOT_MODELS = [
  "AspectHyperstructure",
  "AspectMembers",
  "AspectActivity",
  "HomeAspect",
  "RaceMember",
  "RaceResult",
  "ExplorerTroops",
  "DeepArmy",
  "DeepSite",
  "DeepGuard",
  "AltarBar",
  "WorldBane",
  "TeamBane",
  "Seal",
  "Structure",
] as const;

export const LEADERBOARD_RULE =
  "Calling /games/:id/leaderboard on a Season 1 game returns 404 season_one_ranks_aspects, so read /games/:id/aspects/:aspect_id/members instead.";

export const RATE_ETIQUETTE = [
  `Most Herald routes set Cache-Control: no-store (/games/:id/stats sets public, max-age=${STATS_CACHE_SECONDS}), so cache responses on your side for at least 60 seconds (or 1 hour for dashboards and spreadsheets).`,
  "Always pass ?models=... on /snapshot instead of requesting the whole world.",
  `Use the maximum page size (limit=${ROSTER_PAGE_LIMIT} on /members, limit=${HISTORY_PAGE_LIMIT} on /history) and page sequentially rather than firing dozens of concurrent offsets.`,
  "Subscribe to GET /games/updates (SSE) instead of polling /games every second.",
  "Do not scan tens of thousands of historical blocks over RPC from a browser; read Herald's folded /snapshot and /history routes instead.",
] as const;

export const PUBLIC_ROUTES: readonly PublicRouteSpec[] = [
  {
    method: "GET",
    base: "herald",
    path: "/games",
    params: "optional ?player=0x...",
    returns:
      "confirmed_block, world_address, and games[] (game_id, name, mode, status, player_count, settled_realms_count, aspect_members, aspect_race, clock)",
  },
  {
    method: "GET",
    base: "herald",
    path: "/manifest",
    params: "none",
    returns: "version, chainId, rpcUrl, and contracts.games",
  },
  {
    method: "GET",
    base: "herald",
    path: "/health",
    params: "none",
    returns: "confirmed_block, decoded_models, service, success, undecodable_events",
  },
  {
    method: "GET",
    base: "herald",
    path: "/games/:id/snapshot",
    params: "?models=Name1,Name2 (optional &actor=0x..., &owner=0x...)",
    returns: "game_id, confirmed_block, and models[] with hex-encoded row values",
  },
  {
    method: "GET",
    base: "herald",
    path: "/games/:id/aspects/:aspect_id/members",
    params: `?limit=1..${ROSTER_PAGE_LIMIT} (default ${ROSTER_PAGE_DEFAULT})&offset=0`,
    returns: "total, limit, offset, and members[] (rank, entity_id, realm_id, owner, unscaled decimal glory)",
  },
  {
    method: "GET",
    base: "herald",
    path: "/games/:id/history",
    params: `?model=StoryEvent or BattleEvent, optional &story=..., &owner=0x..., &entity_id=..., &limit=0..${HISTORY_PAGE_LIMIT} (default ${HISTORY_PAGE_DEFAULT})&offset=0`,
    returns: "complete_through_block, total, limit, offset, and items[] newest first",
  },
  {
    method: "GET",
    base: "herald",
    path: "/games/:id/sites/:entity_id",
    params: "decimal site entity_id in path",
    returns: "ExpeditionSite row or 404 unknown_site",
  },
  {
    method: "GET",
    base: "herald",
    path: "/games/:id/stats",
    params: "none",
    returns: `game_id, players, realms, and transactions ({ total, days: [{ day, transactions }] }); Cache-Control: public, max-age=${STATS_CACHE_SECONDS} (${statsCacheText}s)`,
  },
  {
    method: "GET",
    base: "herald",
    path: "/games/updates",
    params: "Server-Sent Events stream",
    returns: "data: changed whenever the game directory updates",
  },
  {
    method: "GET",
    base: "herald",
    path: "/games/:id/days/:day/ranks",
    params: "closed day number in path",
    returns: "closed Frontier day ranks (404 until the day closes)",
  },
  {
    method: "GET",
    base: "herald",
    path: "/games/:id/review/snapshot",
    params: "none",
    returns: "frozen end-of-game snapshot (404 while the game is live)",
  },
  {
    method: "POST",
    base: "rpc",
    path: rpcPath,
    params: "JSON-RPC 2.0 body (e.g. starknet_blockNumber, starknet_getBlockWithTxHashes)",
    returns: "standard Starknet JSON-RPC response",
  },
];

const routeUrl = (route: PublicRouteSpec) => (route.base === "herald" ? `${heraldUrl}${route.path}` : rpcUrl);

const snapshotModelsList = SNAPSHOT_MODELS.join(", ");

const routesTable = PUBLIC_ROUTES.map(
  (route) => `${route.method} ${route.path} | ${route.params} | ${route.returns}`,
).join("\n");

export const buildAgentPrompt = (routes: readonly PublicRouteSpec[]) => {
  const routeLines = routes.map(
    (route) => `- ${route.method} ${routeUrl(route)} (${route.params}) -> ${route.returns}`,
  );
  return [
    "You are helping me read public Realms: Frontier onchain game data. All data is read-only and public; no API key, wallet, or account is needed.",
    "",
    "Base URLs (CORS enabled for browsers; send a standard User-Agent header if using Python urllib):",
    `- Herald HTTP API: ${heraldUrl}`,
    `- Shard Starknet JSON-RPC: ${rpcUrl}`,
    "",
    "Finding the active game_id:",
    `- Call GET ${heraldUrl}/games first.`,
    "- Pick the game whose name matches /^frontier-\\d+$/ for Season 1, or fall back to the active testnet-* game (currently game_id 1 during Final Testnet).",
    "",
    `Aspect IDs: ${aspectListLine}.`,
    "",
    "Units and encoding:",
    `- Snapshot row numbers are hex strings ("0x..."). Parse with BigInt(value) and divide raw resource, troop, or raw Glory amounts by ${precisionText} (10^9).`,
    "- /games/:id/aspects/:aspect_id/members already returns glory as an unscaled decimal string.",
    "- History item.value.timestamp values are Unix timestamps in seconds (hex or decimal string).",
    `- Useful /snapshot models: ${snapshotModelsList}.`,
    "",
    "Public routes:",
    ...routeLines,
    "",
    "Rate limits and caching etiquette:",
    ...RATE_ETIQUETTE.map((rule) => `- ${rule}`),
    "",
    "What NOT to do:",
    "- Read-only only: never send write calls, transactions, or mutations.",
    "- Never ask for private keys, API keys, or private endpoints.",
    `- ${LEADERBOARD_RULE}`,
    "",
    "Example questions you can answer for me:",
    "1. Show the top Glory earners per Aspect today.",
    "2. Show my Aspect's standing (hyperstructure height, member count, top 10 Glory).",
    "3. Export all Aspect rosters as a CSV.",
    "4. Count realms created per UTC day.",
    "",
    "My question: Show the top Glory earners per Aspect today.",
  ].join("\n");
};

export const PUBLIC_DATA = {
  heraldUrl,
  rpcUrl,
  aspectsCount: String(aspects.length),
  aspects: aspects.map((aspect) => ({
    id: String(aspect.id),
    name: aspect.name,
    icon: aspectMeaning(aspect.id),
  })),
  limits: {
    rosterDefault: String(ROSTER_PAGE_DEFAULT),
    rosterMax: String(ROSTER_PAGE_LIMIT),
    historyDefault: String(HISTORY_PAGE_DEFAULT),
    historyMax: String(HISTORY_PAGE_LIMIT),
  },
  snapshotModelsList,
  leaderboardRule: LEADERBOARD_RULE,
  rateEtiquette: RATE_ETIQUETTE,
  routesTable,
  agentPrompt: buildAgentPrompt(PUBLIC_ROUTES),
  snippets: {
    gamesCurl: `curl -sS ${heraldUrl}/games`,
    gamesJs: `const directory = await fetch("${heraldUrl}/games").then((r) => r.json());
const season = directory.games.find((g) => /^frontier-\\d+$/.test(g.name)) ?? directory.games[0];
console.log(season.game_id, season.name, season.status, season.aspect_race);`,
    manifestCurl: `curl -sS ${heraldUrl}/manifest`,
    manifestJs: `const manifest = await fetch("${heraldUrl}/manifest").then((r) => r.json());
console.log(manifest.chainId, manifest.rpcUrl, manifest.contracts.games);`,
    healthCurl: `curl -sS ${heraldUrl}/health`,
    healthJs: `const health = await fetch("${heraldUrl}/health").then((r) => r.json());
console.log(health.confirmed_block, health.success);`,
    snapshotCurl: `curl -sS "${heraldUrl}/games/1/snapshot?models=AspectHyperstructure,AspectActivity,DeepSite"`,
    snapshotJs: `const models = "AspectHyperstructure,AspectActivity,DeepSite";
const snap = await fetch(\`${heraldUrl}/games/1/snapshot?models=\${models}\`).then((r) => r.json());
for (const entry of snap.models) console.log(entry.model, entry.rows.length);`,
    membersCurl: `curl -sS "${heraldUrl}/games/1/aspects/${sampleAspectId}/members?limit=${ROSTER_PAGE_DEFAULT}&offset=0"`,
    membersJs: `const roster = await fetch(
  "${heraldUrl}/games/1/aspects/${sampleAspectId}/members?limit=${ROSTER_PAGE_DEFAULT}&offset=0",
).then((r) => r.json());
console.log(roster.total, roster.members);`,
    historyCurl: `curl -sS "${heraldUrl}/games/1/history?model=StoryEvent&story=RealmCreatedStory&limit=${HISTORY_PAGE_DEFAULT}&offset=0"`,
    historyJs: `const url =
  "${heraldUrl}/games/1/history?model=StoryEvent&story=RealmCreatedStory&limit=${HISTORY_PAGE_DEFAULT}&offset=0";
const page = await fetch(url).then((r) => r.json());
console.log(page.complete_through_block, page.total, page.items.length);`,
    siteCurl: `curl -sS "${heraldUrl}/games/1/sites/1"`,
    siteJs: `const response = await fetch("${heraldUrl}/games/1/sites/1");
console.log(response.status, await response.json());`,
    rpcCurl: `curl -sS -X POST ${rpcUrl} \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"starknet_blockNumber","params":[]}'`,
    rpcJs: `const rpc = (method, params) =>
  fetch("${rpcUrl}", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  }).then((r) => r.json());

const head = await rpc("starknet_blockNumber", []);
const latest = await rpc("starknet_getBlockWithTxHashes", ["latest"]);
console.log(head.result, latest.result.block_number, latest.result.transactions.length);`,
    recipeStanding: `const HERALD = "${heraldUrl}";
const ASPECTS = ${aspectMapLiteral};
const myAspect = ${sampleAspectId};

const dir = await fetch(\`\${HERALD}/games\`).then((r) => r.json());
const game = dir.games.find((g) => /^frontier-\\d+$/.test(g.name)) ?? dir.games[0];
const top = await fetch(\`\${HERALD}/games/\${game.game_id}/aspects/\${myAspect}/members?limit=10&offset=0\`).then((r) =>
  r.json(),
);

console.log(
  JSON.stringify(
    {
      game: game.name,
      status: game.status,
      aspect: ASPECTS[myAspect],
      height: game.aspect_race.heights[String(myAspect)],
      finish_height: game.aspect_race.finish_height,
      members: game.aspect_members[String(myAspect)],
      top_members: top.members,
    },
    null,
    2,
  ),
);`,
    recipeCsv: `const HERALD = "${heraldUrl}";
const ASPECTS = ${aspectMapLiteral};

const dir = await fetch(\`\${HERALD}/games\`).then((r) => r.json());
const game = dir.games.find((g) => /^frontier-\\d+$/.test(g.name)) ?? dir.games[0];

const rows = ["aspect,rank,owner,realm_id,glory"];
for (const [id, name] of Object.entries(ASPECTS)) {
  for (let offset = 0; ; offset += ${ROSTER_PAGE_LIMIT}) {
    const page = await fetch(
      \`\${HERALD}/games/\${game.game_id}/aspects/\${id}/members?limit=${ROSTER_PAGE_LIMIT}&offset=\${offset}\`,
    ).then((r) => r.json());
    for (const m of page.members) {
      rows.push(\`\${name},\${m.rank},\${m.owner},\${m.realm_id},\${m.glory}\`);
    }
    if (offset + page.limit >= page.total) break;
  }
}

console.log(rows.join("\\n"));`,
    recipeRealmsPerDay: `const HERALD = "${heraldUrl}";

const dir = await fetch(\`\${HERALD}/games\`).then((r) => r.json());
const game = dir.games.find((g) => /^frontier-\\d+$/.test(g.name)) ?? dir.games[0];

const counts = {};
for (let offset = 0; ; offset += ${HISTORY_PAGE_LIMIT}) {
  const page = await fetch(
    \`\${HERALD}/games/\${game.game_id}/history?model=StoryEvent&story=RealmCreatedStory&limit=${HISTORY_PAGE_LIMIT}&offset=\${offset}\`,
  ).then((r) => r.json());
  for (const item of page.items) {
    const day = new Date(Number(BigInt(item.value.timestamp)) * 1000).toISOString().slice(0, 10);
    counts[day] = (counts[day] ?? 0) + 1;
  }
  if (offset + page.limit >= page.total) break;
}

console.log(JSON.stringify(counts, null, 2));`,
  },
} as const;
