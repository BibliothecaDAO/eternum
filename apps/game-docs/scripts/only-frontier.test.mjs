import assert from "node:assert/strict";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import fg from "fast-glob";
import { forbiddenModeMatches } from "./check-rendered-balance.mjs";

const docsRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const docsDir = join(docsRoot, "docs");
const vocs = dirname(fileURLToPath(import.meta.resolve("vocs")));
const { resolveVocsConfig } = await import(pathToFileURL(join(vocs, "vite/utils/resolveVocsConfig.js")).href);
const { renderLlmTxt } = await import(new URL("../vite-plugin-llm-txt.mjs", import.meta.url).href);

const flattenSidebar = (items) =>
  (items ?? []).flatMap((item) => [{ text: item.text ?? "", link: item.link ?? "" }, ...flattenSidebar(item.items)]);

const navViolations = (sidebar) =>
  flattenSidebar(sidebar).flatMap(({ text, link }) =>
    forbiddenModeMatches(`${text} ${link}`, false).map((reason) => `${text} (${link}): ${reason}`),
  );

test("the sidebar nav names no Blitz, Devcon, Season 0 or Eternum", async () => {
  const cwd = process.cwd();
  process.chdir(docsRoot);
  try {
    const { config } = await resolveVocsConfig({ command: "build" });
    const sidebar = Array.isArray(config.sidebar) ? config.sidebar : Object.values(config.sidebar ?? {}).flat();
    assert.deepEqual(navViolations(sidebar), []);
  } finally {
    process.chdir(cwd);
  }
});

test("nav guard fails when Blitz, Devcon, Season 0 or Eternum appears in sidebar", () => {
  for (const [text, link] of [
    ["Blitz", "/blitz"],
    ["Devcon season", "/devcon"],
    ["Season 0", "/frontier/season-0"],
    ["Eternum", "/eternum"],
  ]) {
    assert.ok(navViolations([{ text, link }]).length > 0, `expected failure for ${text}`);
  }
});

test("every docs page export omits Blitz, Devcon and Season 0, and Eternum outside development pages", async () => {
  const files = await fg([`${docsDir}/**/*.mdx`], { absolute: true });
  const llm = await renderLlmTxt(files, docsDir);
  const violations = llm.split("\n\n---\n\n").flatMap((section) => {
    const file = section.match(/^file: (\S+)/)?.[1] ?? "llm.txt";
    const allowEternumName = file.startsWith("docs/pages/development/");
    return forbiddenModeMatches(section, allowEternumName).map((reason) => `${file}: ${reason}`);
  });
  assert.deepEqual(violations, []);
});

test("rendered page guard rejects Blitz, Devcon, Season 0, retired HUD terms, and Eternum on player pages", () => {
  assert.ok(forbiddenModeMatches("Try Blitz for fast matches", false).length > 0);
  assert.ok(forbiddenModeMatches("From the Devcon season", true).length > 0);
  assert.ok(forbiddenModeMatches("Rewards from Season 0", true).length > 0);
  assert.ok(forbiddenModeMatches("Play Eternum onchain", false).length > 0);
  assert.ok(forbiddenModeMatches("Next up on the right", false).length > 0);
  assert.ok(forbiddenModeMatches("Up next panel", false).length > 0);
  assert.ok(forbiddenModeMatches("Build a War hall", false).length > 0);
  assert.ok(forbiddenModeMatches("What you can't do", false).length > 0);
  assert.deepEqual(forbiddenModeMatches("Eternum runs native Cairo domains on Madara", true), []);
});
