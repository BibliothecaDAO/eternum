/**
 * Vocs ships its whole config in the site's bundle (its `virtual:config` module is `serializeConfig(config)`). The
 * docs' filesystem settings, the public folder and the import aliases, are therefore set only by the plugin hook in
 * `vocs.config.ts`, whose function ships as source text. These tests load the docs' config with Vocs' own loader,
 * serialize it with Vocs' own serializer, and require that the shipped config carries none of those fields.
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const docsRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const vocs = dirname(fileURLToPath(import.meta.resolve("vocs")));
const { resolveVocsConfig } = await import(pathToFileURL(join(vocs, "vite/utils/resolveVocsConfig.js")).href);
const { serializeConfig } = await import(pathToFileURL(join(vocs, "config.js")).href);

/** The Vite settings the docs' hook owns: in the shipped config they would publish this machine's folders. */
const HOOK_FIELDS = [
  ["vite", "publicDir"],
  ["vite", "resolve", "alias"],
];

/** The hook-owned fields a serialized config carries, by name. */
function hookFieldsIn(serialized) {
  const config = JSON.parse(serialized);
  return HOOK_FIELDS.filter((path) => path.reduce((value, key) => value?.[key], config) !== undefined).map((path) =>
    path.join("."),
  );
}

/** The docs' config as Vocs loads it for a command and puts it in the bundle. */
async function shippedConfig(command) {
  const cwd = process.cwd();
  process.chdir(docsRoot);
  try {
    return serializeConfig((await resolveVocsConfig({ command })).config);
  } finally {
    process.chdir(cwd);
  }
}

for (const [command, name] of [
  ["build", "vocs build"],
  ["serve", "vocs dev"],
])
  test(`the config Vocs ships for \`${name}\` sets no filesystem field the hook owns`, async () => {
    const shipped = await shippedConfig(command);
    assert.ok(shipped.includes('"title":"Realms Docs"'), "the docs' own config was loaded");
    assert.deepEqual(hookFieldsIn(shipped), []);
  });

test("a public folder written in the config is refused, wherever it points", () => {
  assert.deepEqual(hookFieldsIn(serializeConfig({ vite: { publicDir: "/data/build/public" } })), ["vite.publicDir"]);
});

test("an import alias written in the config is refused, wherever it points", () => {
  const config = { vite: { resolve: { alias: { "@": "/__w/eternum/eternum/apps/game-docs/docs" } } } };
  assert.deepEqual(hookFieldsIn(serializeConfig(config)), ["vite.resolve.alias"]);
});

test("a site address that looks like a folder is the site's own and passes", () => {
  assert.deepEqual(hookFieldsIn(serializeConfig({ iconUrl: "/home/news", logoUrl: "/images/logo.svg" })), []);
});

test("the same settings given through a plugin hook ship as the hook's source, not as fields", () => {
  const config = { vite: { plugins: [{ name: "docs-paths", config: () => ({ publicDir: "/data/build/public" }) }] } };
  assert.deepEqual(hookFieldsIn(serializeConfig(config)), []);
});

/** The docs' shipped config, loaded with the client's environment constant set as the deployment sets it. */
async function shippedFor(environment) {
  const before = process.env.VITE_PUBLIC_ENVIRONMENT;
  if (environment === undefined) delete process.env.VITE_PUBLIC_ENVIRONMENT;
  else process.env.VITE_PUBLIC_ENVIRONMENT = environment;
  try {
    return JSON.parse(await shippedConfig("build"));
  } finally {
    if (before === undefined) delete process.env.VITE_PUBLIC_ENVIRONMENT;
    else process.env.VITE_PUBLIC_ENVIRONMENT = before;
  }
}

for (const [environment, origin] of [
  ["production", "https://play.realms.party"],
  ["staging", "https://play.dev-realms.party"],
  [undefined, "https://play.dev-realms.party"],
])
  test(`pages built for ${environment ?? "no environment"} unfurl with ${origin}'s own link preview`, async () => {
    const image = new URL((await shippedFor(environment)).ogImageUrl);
    assert.equal(image.origin, origin);
    assert.match(image.pathname, /^\/images\/covers\/link-preview-[0-9a-f]{8}\.png$/);
    assert.ok(
      existsSync(join(docsRoot, "../game/public", image.pathname)),
      `${image.pathname} is a file the app serves`,
    );
  });
