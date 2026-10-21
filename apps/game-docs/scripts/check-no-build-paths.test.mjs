import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

import { buildPathsIn } from "./check-no-build-paths.mjs";

/** The paths found in a built folder holding one file `name` with `body`. */
async function pathsInBuild(name, body) {
  const dist = mkdtempSync(join(tmpdir(), "docs-dist-"));
  after(() => rmSync(dist, { recursive: true, force: true }));
  writeFileSync(join(dist, name), body);
  return (await buildPathsIn(dist)).map(({ path }) => path);
}

test("the site's own root-relative addresses and web URLs pass", async () => {
  const body = `<img src="/images/covers/og-image.png"><a href="/blitz/key-concepts/">x</a>
    <script>fetch("/.vocs/search-index-1.json");import("/assets/index-a.js")</script>
    <a href="https://example.com/home/news">news</a><a href="https://docs.realms.party/frontier/chests">c</a>`;
  assert.deepEqual(await pathsInBuild("index.html", body), []);
});

test("a path in the checkout that built the docs fails", async () => {
  const body = 'export const config={alias:{"@":"/home/djizus/projects/eternum-lanes/rollout-26/apps/game-docs/docs"}}';
  assert.deepEqual(await pathsInBuild("index-a.js", body), [
    "/home/djizus/projects/eternum-lanes/rollout-26/apps/game-docs/docs",
  ]);
});

test("a path outside the checkout that built the docs fails too", async () => {
  const body = '{"vite":{"publicDir":"/home/other-builder/shared-assets/public"}}';
  assert.deepEqual(await pathsInBuild("config.json", body), ["/home/other-builder/shared-assets/public"]);
});

test("temporary, workspace and macOS home paths fail", async () => {
  const body = `a("/tmp/realms-deploy-x1/apps/game-docs/docs");b("/workspace/eternum/config");c("/Users/builder/eternum")`;
  assert.deepEqual((await pathsInBuild("chunk.js", body)).sort(), [
    "/Users/builder/eternum",
    "/tmp/realms-deploy-x1/apps/game-docs/docs",
    "/workspace/eternum/config",
  ]);
});

test("Windows paths from a drive letter fail, escaped or not", async () => {
  const body = String.raw`a("C:\\Users\\builder\\eternum\\docs");b("D:/builds/eternum/public")`;
  assert.deepEqual(await pathsInBuild("chunk.js", body), [
    String.raw`C:\\Users\\builder\\eternum\\docs`,
    "D:/builds/eternum/public",
  ]);
});

test("a picture's bytes are not read as text", async () => {
  assert.deepEqual(await pathsInBuild("cover.png", "\x89PNG /home/not/a/path C:\\x"), []);
});
