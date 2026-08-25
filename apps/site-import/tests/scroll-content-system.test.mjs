import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();

test("Scroll: content directory and sample markdown posts exist", () => {
  const contentDir = join(ROOT, "content", "scroll");
  const firstPost = join(contentDir, "2026-02-10-ecosystem-roundup.md");
  const secondPost = join(contentDir, "2026-02-11-thought-piece-onchain-worlds.md");

  assert.equal(existsSync(contentDir), true, "Expected content/scroll directory");
  assert.equal(existsSync(firstPost), true, "Expected first sample scroll post");
  assert.equal(existsSync(secondPost), true, "Expected second sample scroll post");
});

test("Scroll: build pipeline wires prebuild generator script", () => {
  const packageJson = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  const scripts = packageJson.scripts ?? {};

  assert.equal(typeof scripts.prebuild, "string", "Expected prebuild script");
  assert.match(
    scripts.prebuild,
    /generate-scroll-posts/,
    "Expected prebuild to invoke scroll generator"
  );
});

test("Scroll: generator emits a static module with expected sample slugs", () => {
  const scriptPath = join(ROOT, "scripts", "generate-scroll-posts.mjs");
  assert.equal(existsSync(scriptPath), true, "Expected scripts/generate-scroll-posts.mjs");

  const run = spawnSync("node", [scriptPath], {
    cwd: ROOT,
    encoding: "utf8",
  });

  assert.equal(run.status, 0, `Generator failed: ${run.stderr || run.stdout}`);

  const generatedPath = join(ROOT, "src", "generated", "scroll-posts.ts");
  assert.equal(existsSync(generatedPath), true, "Expected generated scroll module");

  const generated = readFileSync(generatedPath, "utf8");
  assert.match(generated, /ecosystem-roundup/);
  assert.match(generated, /thought-piece-onchain-worlds/);
});

test("Scroll: routes exist for list and detail pages", () => {
  const indexPath = join(ROOT, "src", "routes", "scroll", "index.tsx");
  const detailPath = join(ROOT, "src", "routes", "scroll", "$slug.tsx");

  assert.equal(existsSync(indexPath), true, "Expected /scroll index route file");
  assert.equal(existsSync(detailPath), true, "Expected /scroll/$slug route file");

  const indexRoute = readFileSync(indexPath, "utf8");
  const detailRoute = readFileSync(detailPath, "utf8");

  assert.match(indexRoute, /createFileRoute\("\/scroll\/"\)/);
  assert.match(detailRoute, /createFileRoute\("\/scroll\/\$slug"\)/);
});
