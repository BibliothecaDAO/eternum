import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { RESOURCE_PRECISION, aspects } from "@bibliothecadao/types";

const here = fileURLToPath(new URL(".", import.meta.url));
const heraldHttpSource = readFileSync(join(here, "../../herald/src/http.ts"), "utf8");
const heraldTypesSource = readFileSync(join(here, "../../../packages/core/src/sync/herald-http-types.ts"), "utf8");
const INTERNAL_OR_NON_S1_HERALD_PATHS = new Set(["/schemas/", "/history/story-events", "leaderboardPath"]);

const loadPublicData = async () => {
  const server = await createServer({ configFile: false, logLevel: "silent", appType: "custom" });
  try {
    const publicData = await server.ssrLoadModule(join(here, "../docs/utils/public-data.ts"));
    const limits = await server.ssrLoadModule(join(here, "../../herald/src/http-limits.ts"));
    const { buildAspectRoster } = await server.ssrLoadModule(join(here, "../../herald/src/native/aspect-roster.ts"));
    return { ...publicData, limits, buildAspectRoster };
  } finally {
    await server.close();
  }
};

const concreteSamplePath = (routePath) => routePath.replace(/:[a-z_]+/g, "1");

const heraldRegexRoutes = () =>
  [...heraldHttpSource.matchAll(/const\s+(\w+Path)\s*=\s*\/([^;]+)\/;/g)]
    .filter(([, name]) => !INTERNAL_OR_NON_S1_HERALD_PATHS.has(name))
    .map(([, name, pattern]) => ({ name, regex: new RegExp(pattern) }));

const heraldLiteralRoutes = () => [
  "/games",
  "/games/updates",
  ...[...heraldHttpSource.matchAll(/url\.pathname\s*===\s*"([^"]+)"/g)]
    .map(([, path]) => path)
    .filter((path) => !INTERNAL_OR_NON_S1_HERALD_PATHS.has(path)),
];

const interfaceFields = (source, name) => {
  const match = source.match(new RegExp(`export interface ${name}\\s*\\{([\\s\\S]*?)\\n\\}`));
  assert.ok(match, `expected interface ${name}`);
  return [...match[1].matchAll(/^\s*([a-z_]+)\??:/gm)].map(([, field]) => field);
};

test("PUBLIC_ROUTES matches every public GET route in apps/herald/src/http.ts", async () => {
  const { PUBLIC_ROUTES } = await loadPublicData();
  const heraldDocsRoutes = PUBLIC_ROUTES.filter((route) => route.base === "herald");
  const samples = heraldDocsRoutes.map((route) => concreteSamplePath(route.path));

  for (const literal of heraldLiteralRoutes()) {
    assert.ok(samples.includes(literal), `missing Herald literal route ${literal} from PUBLIC_ROUTES`);
  }
  for (const { name, regex } of heraldRegexRoutes()) {
    assert.ok(
      samples.some((sample) => regex.test(sample)),
      `missing Herald regex route ${name} (${regex}) from PUBLIC_ROUTES`,
    );
  }
  for (const route of heraldDocsRoutes) {
    const sample = concreteSamplePath(route.path);
    const recognized =
      heraldLiteralRoutes().includes(sample) || heraldRegexRoutes().some(({ regex }) => regex.test(sample));
    assert.ok(recognized, `documented route ${route.path} does not match any route in apps/herald/src/http.ts`);
  }
});

test("/games/:id/stats documents exact HeraldGameStats fields and STATS_CACHE_SECONDS", async () => {
  const { PUBLIC_DATA, PUBLIC_ROUTES, limits } = await loadPublicData();
  const statsRoute = PUBLIC_ROUTES.find((route) => route.path === "/games/:id/stats");
  assert.ok(statsRoute);
  for (const field of interfaceFields(heraldTypesSource, "HeraldGameStats")) {
    assert.ok(statsRoute.returns.includes(field), `stats route returns must name ${field}`);
    assert.ok(PUBLIC_DATA.agentPrompt.includes(field), `agent prompt must name ${field}`);
  }
  assert.ok(statsRoute.returns.includes(`max-age=${limits.STATS_CACHE_SECONDS}`));
  assert.ok(PUBLIC_DATA.agentPrompt.includes(`max-age=${limits.STATS_CACHE_SECONDS}`));
});

test("buildAgentPrompt renders dynamically from its route list and shares single-source rules", async () => {
  const { LEADERBOARD_RULE, PUBLIC_DATA, PUBLIC_ROUTES, RATE_ETIQUETTE, SNAPSHOT_MODELS, buildAgentPrompt } =
    await loadPublicData();
  for (const route of PUBLIC_ROUTES) {
    const expectedUrl = route.base === "herald" ? `${PUBLIC_DATA.heraldUrl}${route.path}` : PUBLIC_DATA.rpcUrl;
    assert.ok(PUBLIC_DATA.agentPrompt.includes(`${route.method} ${expectedUrl}`));
    assert.ok(PUBLIC_DATA.routesTable.includes(`${route.method} ${route.path} | `));
  }
  const withoutDays = buildAgentPrompt(PUBLIC_ROUTES.filter((route) => route.path !== "/games/:id/days/:day/ranks"));
  assert.equal(withoutDays.includes("/games/:id/days/:day/ranks"), false);

  for (const model of SNAPSHOT_MODELS) assert.ok(PUBLIC_DATA.agentPrompt.includes(model));
  for (const rule of RATE_ETIQUETTE) assert.ok(PUBLIC_DATA.agentPrompt.includes(rule));
  assert.ok(PUBLIC_DATA.agentPrompt.includes(LEADERBOARD_RULE));
  assert.ok(PUBLIC_DATA.agentPrompt.includes(RESOURCE_PRECISION.toLocaleString("en-US")));
  for (const aspect of aspects) assert.ok(PUBLIC_DATA.agentPrompt.includes(`${aspect.id} = ${aspect.name}`));
});

test("/members glory encoding matches buildAspectRoster raw RESOURCE_PRECISION scaling", async () => {
  const { PUBLIC_DATA, PUBLIC_ROUTES, buildAspectRoster } = await loadPublicData();
  const rawTenGlory = BigInt(10 * RESOURCE_PRECISION);
  const rows = {
    RaceRules: [{ key: "0x1", value: { game_id: "0x1" } }],
    Structure: [
      {
        key: "0x1:0x42",
        value: { game_id: "0x1", entity_id: "0x42", owner: "0xabc", metadata: { realm_id: "0x7" } },
      },
    ],
    HomeAspect: [{ key: "0x1:0x42", value: { game_id: "0x1", home: "0x42", aspect: "0x1" } }],
    RaceMember: [
      { key: "0x1:0x42", value: { game_id: "0x1", entity_id: "0x42", glory: `0x${rawTenGlory.toString(16)}` } },
    ],
  };
  const roster = buildAspectRoster((model) => rows[model] ?? [], "1", 1);
  assert.ok(roster && roster.length === 1);
  assert.equal(roster[0].glory, rawTenGlory.toString());

  const membersRoute = PUBLIC_ROUTES.find((route) => route.path === "/games/:id/aspects/:aspect_id/members");
  assert.ok(membersRoute);
  assert.equal(membersRoute.returns.toLowerCase().includes("unscaled"), false);
  assert.equal(PUBLIC_DATA.agentPrompt.toLowerCase().includes("unscaled"), false);
  assert.ok(membersRoute.returns.includes(RESOURCE_PRECISION.toLocaleString("en-US")));
  assert.ok(PUBLIC_DATA.agentPrompt.includes(rawTenGlory.toString()));
});
