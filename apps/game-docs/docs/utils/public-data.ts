import { aspects } from "@bibliothecadao/types";
import productionRelease from "../../../../deploy/release/production.json";
import {
  HISTORY_PAGE_DEFAULT,
  HISTORY_PAGE_LIMIT,
  ROSTER_PAGE_DEFAULT,
  ROSTER_PAGE_LIMIT,
} from "../../../herald/src/http-limits";
import { aspectMeaning } from "../../../game/src/ui/design-system/icon-meaning";

const heraldUrl = productionRelease.public_herald_url;
const rpcUrl = productionRelease.public_rpc_url;
const aspectMapLiteral = `{ ${aspects.map((aspect) => `${aspect.id}: "${aspect.name}"`).join(", ")} }`;
const sampleAspectId = aspects[1].id;

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
