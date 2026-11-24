import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createServer } from "vite";

const here = fileURLToPath(new URL(".", import.meta.url));
const docsRoot = resolve(dirname(here));
const pagesDir = join(docsRoot, "docs/pages");
const vocs = dirname(fileURLToPath(import.meta.resolve("vocs")));
const { resolveVocsConfig } = await import(pathToFileURL(join(vocs, "vite/utils/resolveVocsConfig.js")).href);

const loadSidebarTree = async () => {
  const server = await createServer({ configFile: false, logLevel: "silent", appType: "custom" });
  try {
    return await server.ssrLoadModule(join(here, "../docs/utils/sidebar-tree.ts"));
  } finally {
    await server.close();
  }
};

const pageExists = (link) => {
  const trimmed = link.replace(/^\/|\/$/g, "");
  if (!trimmed) return existsSync(join(pagesDir, "index.mdx"));
  return existsSync(join(pagesDir, `${trimmed}.mdx`)) || existsSync(join(pagesDir, trimmed, "index.mdx"));
};

const collectAllLinks = (items) =>
  (items ?? []).flatMap((item) => [...(item.link ? [item.link] : []), ...collectAllLinks(item.items)]);

test("top-level sidebar follows Realms multi-game order: Global, Frontier, Data, Developers", async () => {
  const cwd = process.cwd();
  process.chdir(docsRoot);
  try {
    const { config } = await resolveVocsConfig({ command: "build" });
    const sidebar = Array.isArray(config.sidebar) ? config.sidebar : [];
    assert.deepEqual(
      sidebar.map((section) => section.text),
      ["Global", "Frontier", "Data", "Developers"],
    );
    assert.equal(Boolean(sidebar[0].collapsed), false);
    assert.equal(Boolean(sidebar[1].collapsed), false);
    assert.equal(Boolean(sidebar[2].collapsed), false);
    assert.equal(sidebar[3].collapsed, true);

    const frontier = sidebar[1];
    assert.equal(frontier.items[0].text, "Overview");
    assert.equal(frontier.items[0].link, "/frontier");
    assert.deepEqual(
      frontier.items.slice(1).map((group) => group.text),
      ["Your realm", "Armies", "Exploring", "The Deep", "The season", "Shop and friends"],
    );
    const armies = frontier.items.find((group) => group.text === "Armies");
    assert.ok(armies && !armies.collapsed);
    assert.ok(armies.items.some((item) => item.text === "Oaths" && item.link === "/frontier/oaths"));

    for (const link of collectAllLinks(sidebar)) {
      assert.ok(pageExists(link), `sidebar link ${link} has no matching .mdx page`);
    }
  } finally {
    process.chdir(cwd);
  }
});

test("Realms home cards, strips, and Frontier quick links derive from sidebar.json with no empty games", async () => {
  const { firstLinkOf, gameSections, leavesForKind, quickLinksForGame, startLinkForGame } = await loadSidebarTree();
  const games = gameSections();
  assert.deepEqual(
    games.map((game) => game.id),
    ["frontier"],
  );
  for (const game of games) {
    assert.ok(pageExists(firstLinkOf(game)));
    assert.ok(pageExists(startLinkForGame(game.id)));
    assert.ok(game.summary.length > 0);
  }
  assert.deepEqual(
    leavesForKind("global").map((item) => item.text),
    ["Sign in", "Payout wallet", "LORDS"],
  );
  assert.deepEqual(
    leavesForKind("data").map((item) => item.text),
    ["Live dashboard", "Get the data"],
  );
  assert.deepEqual(
    quickLinksForGame("frontier").map((item) => item.text),
    ["Buildings", "Combat", "Oaths", "Relics", "Beasts"],
  );
});
