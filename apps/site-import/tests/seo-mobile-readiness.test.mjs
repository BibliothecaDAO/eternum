import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

test("SEO: robots.txt exists and declares sitemap", () => {
  const robotsPath = join(ROOT, "public", "robots.txt");
  assert.equal(existsSync(robotsPath), true, "Expected public/robots.txt to exist");

  const robots = readFileSync(robotsPath, "utf8");
  assert.match(robots, /User-agent:\s*\*/i);
  assert.match(robots, /Allow:\s*\/?/i);
  assert.match(robots, /Sitemap:\s*https:\/\/realms\.world\/sitemap\.xml/i);
});

test("SEO: sitemap.xml exists and includes core routes", () => {
  const sitemapPath = join(ROOT, "public", "sitemap.xml");
  assert.equal(
    existsSync(sitemapPath),
    true,
    "Expected public/sitemap.xml to exist"
  );

  const sitemap = readFileSync(sitemapPath, "utf8");
  for (const route of [
    "https://realms.world/",
    "https://realms.world/scroll",
    "https://realms.world/scroll/ecosystem-roundup",
    "https://realms.world/games",
    "https://realms.world/games/realms-eternum",
  ]) {
    assert.match(sitemap, new RegExp(route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("Mobile IA: homepage exposes mobile section navigation affordance", () => {
  const topBarPath = join(ROOT, "src", "components", "layout", "TopBar.tsx");
  const topBar = readFileSync(topBarPath, "utf8");

  assert.match(
    topBar,
    /Open section navigation/,
    "Expected an accessible mobile section-nav trigger label"
  );
  assert.match(
    topBar,
    /lg:hidden/,
    "Expected a mobile-only section-nav control (hidden on large screens)"
  );
  assert.match(
    topBar,
    /pageSections\.map/,
    "Expected mobile nav items to be sourced from homepage sections"
  );
});
