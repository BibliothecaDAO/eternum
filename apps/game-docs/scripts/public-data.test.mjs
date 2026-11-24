import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { RESOURCE_PRECISION, aspects } from "@bibliothecadao/types";

const here = fileURLToPath(new URL(".", import.meta.url));

const loadPublicData = async () => {
  const server = await createServer({ configFile: false, logLevel: "silent", appType: "custom" });
  try {
    return await server.ssrLoadModule(join(here, "../docs/utils/public-data.ts"));
  } finally {
    await server.close();
  }
};

const missingPromptRoutes = (prompt, routes, heraldUrl, rpcUrl) =>
  routes
    .map((route) => `${route.method} ${route.base === "herald" ? `${heraldUrl}${route.path}` : rpcUrl}`)
    .filter((entry) => !prompt.includes(entry));

test("agent prompt names every route in PUBLIC_ROUTES, base URLs, precision, limits, and Aspect IDs", async () => {
  const { PUBLIC_DATA, PUBLIC_ROUTES } = await loadPublicData();
  assert.ok(PUBLIC_ROUTES.length >= 8);
  assert.deepEqual(
    missingPromptRoutes(PUBLIC_DATA.agentPrompt, PUBLIC_ROUTES, PUBLIC_DATA.heraldUrl, PUBLIC_DATA.rpcUrl),
    [],
  );
  for (const route of PUBLIC_ROUTES) {
    assert.ok(PUBLIC_DATA.routesTable.includes(`${route.method} ${route.path} | `));
  }
  assert.ok(PUBLIC_DATA.agentPrompt.includes(RESOURCE_PRECISION.toLocaleString("en-US")));
  assert.ok(PUBLIC_DATA.agentPrompt.includes(`limit=${PUBLIC_DATA.limits.rosterMax}`));
  assert.ok(PUBLIC_DATA.agentPrompt.includes(`limit=${PUBLIC_DATA.limits.historyMax}`));
  for (const aspect of aspects) {
    assert.ok(PUBLIC_DATA.agentPrompt.includes(`${aspect.id} = ${aspect.name}`));
  }
  assert.ok(PUBLIC_DATA.agentPrompt.includes("Read-only only"));
  assert.ok(PUBLIC_DATA.agentPrompt.includes("no API key"));
});

test("route coverage check fails if a route disappears from the agent prompt", async () => {
  const { PUBLIC_DATA, PUBLIC_ROUTES } = await loadPublicData();
  const dropped = PUBLIC_DATA.agentPrompt.replace(`${PUBLIC_DATA.heraldUrl}/games/<id>/snapshot`, "");
  const missing = missingPromptRoutes(dropped, PUBLIC_ROUTES, PUBLIC_DATA.heraldUrl, PUBLIC_DATA.rpcUrl);
  assert.equal(missing.length, 1);
  assert.ok(missing[0].includes("/games/<id>/snapshot"));
});
