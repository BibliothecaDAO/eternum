import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const script = new URL("./ship-referenced-assets.mjs", import.meta.url);
/** The asset step, as the build runs it. */
const { referencedAssets } = await import(script.href);

test("a page's image, video, srcset and CSS references are read; page links and other sites are not", () => {
  const html = `<img src="/images/a.png"><img srcset="/icons/b.webp 1x, /icons/c.webp 2x"><video poster="/v/p.jpg">
    <div style="background:url(&quot;/images/d.webp&quot;)"></div><a href="/frontier/expedition">x</a>
    <img src="https://example.com/e.png"><img src="/images/f%20g.png?v=1"><a href="/gifs/h.gif">gif</a>
    <img src="/images/loot-chests/Chest- Blitz - v4.png"><img src="/images/no-extension">`;
  assert.deepEqual([...referencedAssets(html)].sort(), [
    "/gifs/h.gif",
    "/icons/b.webp",
    "/icons/c.webp",
    "/images/a.png",
    "/images/d.webp",
    "/images/f g.png",
    "/images/loot-chests/Chest- Blitz - v4.png",
    "/images/no-extension",
    "/v/p.jpg",
  ]);
});

/** Runs the step on a built site holding one page with this body. */
const run = (body) => {
  const dist = mkdtempSync(join(tmpdir(), "docs-assets-"));
  try {
    mkdirSync(join(dist, "page"));
    writeFileSync(join(dist, "page", "index.html"), `<html><body>${body}</body></html>`);
    const result = spawnSync(process.execPath, [script.pathname, dist], { encoding: "utf8" });
    return {
      status: result.status,
      stderr: result.stderr,
      shipped: existsSync(join(dist, "images/buildings/construction/farm.png")),
    };
  } finally {
    rmSync(dist, { recursive: true, force: true });
  }
};

test("an asset the game ships is copied into the build", () => {
  const { status, shipped } = run('<img src="/images/buildings/construction/farm.png">');
  assert.equal(status, 0);
  assert.equal(shipped, true);
});

test("a reference to an asset that exists nowhere fails, naming it and its page", () => {
  const { status, stderr } = run('<img src="/images/resources/3.png">');
  assert.equal(status, 1);
  assert.match(stderr, /\/images\/resources\/3\.png: no such asset, named by page\/index\.html/);
});
