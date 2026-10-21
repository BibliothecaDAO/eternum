/**
 * Vocs ships its whole config in the site's bundle (its `virtual:config` module is `serializeConfig(config)`). So that
 * config holds no value that only means something on the machine that builds: such values reach Vite through a plugin
 * hook (`vocs.config.ts`), whose function ships as source text. These tests load the docs' config with Vocs' own
 * loader, serialize it with Vocs' own serializer, and hold the result to that boundary.
 */
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const docsRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const checkout = resolve(docsRoot, "../..");
const vocs = dirname(fileURLToPath(import.meta.resolve("vocs")));
const { resolveVocsConfig } = await import(pathToFileURL(join(vocs, "vite/utils/resolveVocsConfig.js")).href);
const { serializeConfig } = await import(pathToFileURL(join(vocs, "config.js")).href);

/** Every value in a serialized config that names this machine: an existing absolute path, or one in the checkout. */
function machineValues(serialized) {
  const found = [];
  const visit = (value) => {
    if (typeof value === "string") {
      if (value.startsWith("_vocs-fn_")) return;
      if ((isAbsolute(value) && existsSync(value)) || value.includes(checkout)) found.push(value);
    } else if (value && typeof value === "object") Object.values(value).forEach(visit);
  };
  visit(JSON.parse(serialized));
  return found;
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

for (const command of ["build", "serve"])
  test(`the config Vocs ships for \`vocs ${command === "build" ? "build" : "dev"}\` names nothing on this machine`, async () => {
    const shipped = await shippedConfig(command);
    assert.ok(shipped.includes('"title":"Realms Docs"'), "the docs' own config was loaded");
    assert.deepEqual(machineValues(shipped), []);
  });

test("a machine path written in the config is found, wherever it points", () => {
  const elsewhere = mkdtempSync(join(tmpdir(), "shared-assets-"));
  after(() => rmSync(elsewhere, { recursive: true, force: true }));
  const config = {
    title: "Realms Docs",
    iconUrl: "/images/logos/eternum-new.svg",
    vite: { publicDir: elsewhere, resolve: { alias: { "@": join(checkout, "apps/game-docs/docs") } } },
  };
  assert.deepEqual(machineValues(serializeConfig(config)), [elsewhere, join(checkout, "apps/game-docs/docs")]);
});

test("a path given through a plugin hook ships as the hook's source, not its value", () => {
  const publicDir = join(checkout, "apps/game/public");
  const config = { vite: { plugins: [{ name: "docs-paths", config: () => ({ publicDir }) }] } };
  assert.deepEqual(machineValues(serializeConfig(config)), []);
});
