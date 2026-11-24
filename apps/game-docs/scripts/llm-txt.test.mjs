import assert from "node:assert/strict";
import { LAYER_NAMES, TIER_WORDS } from "@bibliothecadao/types";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import fg from "fast-glob";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build, createServer, loadConfigFromFile } from "vite";
import { after, before, test } from "node:test";

/** The export generator and the post-build check, as the build runs them. */
const { renderLlmTxt } = await import(new URL("../vite-plugin-llm-txt.mjs", import.meta.url).href);
const { exportProblems, forbiddenValues, frontierGuardPhrases } = await import(
  new URL("./check-rendered-balance.mjs", import.meta.url).href
);

let root;

before(async () => {
  root = await mkdtemp(join(tmpdir(), "llm-txt-test-"));
  await writeFile(join(root, "rules.mjs"), "export const stats = { stamina: 120 };\n");
});

after(() => rm(root, { recursive: true, force: true }));

/** Exports one page holding `body`, as the build does. */
const exportPage = async (name, body) => {
  const file = join(root, `${name}.mdx`);
  await writeFile(file, `import { stats as rules } from "./rules.mjs";\n\n# Page\n\n${body}\n`);
  return renderLlmTxt([file], root);
};

test("the client build ships exactly the current docs pages without a tracked text copy", async () => {
  const gameRoot = fileURLToPath(new URL("../../game", import.meta.url));
  const docs = fileURLToPath(new URL("../docs", import.meta.url));
  const loaded = await loadConfigFromFile(
    { command: "build", mode: "production" },
    join(gameRoot, "vite.config.ts"),
    gameRoot,
    "silent",
  );
  const plugins = (await Promise.all(loaded.config.plugins))
    .flat(Infinity)
    .filter((plugin) => plugin && plugin.name === "vite-plugin-llm-txt");
  assert.equal(plugins.length, 1, "the serving client's build must own its text export");
  await writeFile(join(root, "index.html"), "<!doctype html><title>Export artifact</title>");
  const outDir = join(root, "client-dist");
  await build({
    root,
    configFile: false,
    publicDir: false,
    logLevel: "silent",
    plugins,
    build: { outDir, rollupOptions: { input: join(root, "index.html") } },
  });
  const shipped = await readFile(join(outDir, "llm.txt"), "utf8");
  const pages = await fg("**/*.mdx", { cwd: docs });
  assert.deepEqual([...shipped.matchAll(/^file: docs\/(.+)$/gm)].map((match) => match[1]).sort(), pages.sort());
  assert.doesNotMatch(shipped, /^file: docs\/pages\/eternum\//m);
  assert.doesNotMatch(shipped, /\]\((?:https?:\/\/[^/)]+)?\/eternum(?:[\/#)]|$)/);
  assert.equal(existsSync(join(gameRoot, "public/llm.txt")), false, "a tracked export must not compete with the build");
});

test("a finite value is written as its number", async () => {
  const llm = await exportPage("finite", "An army holds {rules.stamina} stamina, {60 * 2} at most.");
  assert.match(llm, /An army holds 120 stamina, 120 at most\./);
  assert.deepEqual(exportProblems(llm, []), []);
  assert.deepEqual(forbiddenValues(root, llm), []);
});

for (const [name, expression] of [
  ["nan", "Number.NaN"],
  ["infinity", "1 / 0"],
  ["renamed-missing", "rules.missing"],
  ["object-missing", "({}).missing"],
]) {
  test(`{${expression}} fails the export, naming its page and expression`, async () => {
    await assert.rejects(exportPage(name, `Value: {${expression}}`), (error) => {
      assert.match(error.message, new RegExp(`${name}\\.mdx: \\{${expression.replace(/[().*/]/g, "\\$&")}\\}`));
      return true;
    });
  });
}

test("an expression left in the export is reported whatever its name", () => {
  const llm = "file: docs/pages/a.mdx\nmeta: {}\n\nValue: {rules.missing}\n";
  assert.deepEqual(exportProblems(llm, []), [
    { page: "llm.txt docs/pages/a.mdx", run: ["unevaluated {rules.missing}"] },
  ]);
});

test("NaN and a u64 maximum in the export are forbidden values", () => {
  const llm = "file: docs/pages/a.mdx\nmeta: {}\n\nUp to +NaN armies, and 18,446,744,073,709,550 kg.\n";
  assert.equal(forbiddenValues(root, llm).length, 2);
});

test("the expedition page gives camps and rifts their own correct guard column at every depth", async () => {
  const server = await createServer({ configFile: false, logLevel: "silent", appType: "custom" });
  try {
    const { nativePresetForId, nativePresetIdFor } = await server.ssrLoadModule(
      fileURLToPath(new URL("../../../config/source/native.ts", import.meta.url)),
    );
    const frontierPreset = nativePresetForId(nativePresetIdFor("frontier"));
    const pages = [{ page: "frontier/expedition", phrases: frontierGuardPhrases(frontierPreset) }];
    const docs = fileURLToPath(new URL("../docs", import.meta.url));
    const llm = await renderLlmTxt([join(docs, "pages/frontier/expedition.mdx")], docs);
    assert.deepEqual(exportProblems(llm, pages), []);
    assert.ok(!new RegExp(`^\\|\\s*${LAYER_NAMES.at(-1)}\\s*\\|`, "m").test(llm), "the export has no Deep row");
    const combined = llm
      .split("\n")
      .map((line) => {
        if (!line.startsWith("|")) return line;
        const cells = line.split("|").map((cell) => cell.trim());
        if (cells.length !== 8) return line;
        if (cells[2] === "Camps") cells[2] = "Camps and rifts";
        cells.splice(3, 1);
        return cells.join(" | ");
      })
      .join("\n");
    const guardRows = pages[0].phrases.slice(1).map((row) => row.split(" ")[0]);
    assert.deepEqual(guardRows, LAYER_NAMES.slice(0, -1));
    assert.equal(exportProblems(combined, pages).length, 1 + guardRows.length);
  } finally {
    await server.close();
  }
});

test("the expedition export states each layer's three relic tiers and their generated ruin guard ranges", async () => {
  const server = await createServer({ configFile: false, logLevel: "silent", appType: "custom" });
  try {
    const { RELICS_PER_LAYER, previewRuinGuardBounds } = await server.ssrLoadModule(
      fileURLToPath(new URL("../../../contracts/l3/world-native/schema/site-previews.gen.ts", import.meta.url)),
    );
    const docs = fileURLToPath(new URL("../docs", import.meta.url));
    const llm = await renderLlmTxt([join(docs, "pages/frontier/expedition.mdx")], docs);
    const tableLines = llm.split("\n").filter((line) => line.startsWith("|"));
    for (const [depth, layer] of LAYER_NAMES.slice(0, 3).entries()) {
      const row = tableLines.find((line) => new RegExp(`^\\|\\s*${layer}\\s*\\|`).test(line) && line.includes(":"));
      assert.ok(row, `missing ruin guard row for ${layer}`);
      for (const [place, name] of TIER_WORDS.slice(depth, depth + RELICS_PER_LAYER).entries()) {
        const bounds = previewRuinGuardBounds(depth + place + 1, depth)
          .map((value) => value.toLocaleString("en-US"))
          .join("–");
        assert.ok(row.includes(`${name}: ${bounds}`), `missing ruin guards for ${layer} ${name}`);
      }
    }
  } finally {
    await server.close();
  }
});
