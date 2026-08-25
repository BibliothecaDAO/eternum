import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

function read(relPath) {
  return readFileSync(join(ROOT, relPath), "utf8");
}

test("Eternum page: route file exists and defines /eternum", () => {
  const routePath = join(ROOT, "src", "routes", "eternum.tsx");
  assert.equal(existsSync(routePath), true, "Expected new /eternum route file");

  const eternumRoute = read("src/routes/eternum.tsx");
  assert.match(
    eternumRoute,
    /createFileRoute\("\/eternum"\)/,
    "Expected /eternum file route definition"
  );
});

test("Eternum page: includes full-screen autoplay video hero", () => {
  const eternumRoute = read("src/routes/eternum.tsx");
  const stubVideoPath = join(ROOT, "public", "videos", "eternum-stub.mp4");

  assert.match(
    eternumRoute,
    /min-h-\[100svh\]/,
    "Expected full-screen hero section for Eternum"
  );
  assert.match(eternumRoute, /<video/, "Expected hero video element");
  assert.match(eternumRoute, /autoPlay/, "Expected autoplay video");
  assert.match(eternumRoute, /muted/, "Expected muted autoplay video");
  assert.match(eternumRoute, /loop/, "Expected looping hero video");
  assert.match(eternumRoute, /playsInline/, "Expected mobile-safe inline playback");
  assert.doesNotMatch(
    eternumRoute,
    /<video[\s\S]*controls/,
    "Expected hidden native video controls"
  );
  assert.match(
    eternumRoute,
    /\/videos\/eternum-stub\.mp4/,
    "Expected Eternum stub video source path"
  );
  assert.equal(
    existsSync(stubVideoPath),
    true,
    "Expected a local MP4 file at public/videos/eternum-stub.mp4"
  );
});

test("Eternum page: presents docs-aligned cadence contrast against Blitz", () => {
  const eternumRoute = read("src/routes/eternum.tsx");

  assert.match(
    eternumRoute,
    /Eternum\s*->\s*Seasonal strategy over several weeks/i,
    "Expected docs-aligned Eternum duration statement"
  );
  assert.match(
    eternumRoute,
    /Blitz\s*->\s*2hr RTS mode/i,
    "Expected docs-aligned Blitz duration contrast"
  );
  assert.match(
    eternumRoute,
    /Recruit|Gladiator|Warrior|Elite/,
    "Expected bracket tiers from docs to appear in Eternum cadence context"
  );
});

test("TopBar + root layout: Eternum nav and full-bleed routing", () => {
  const topBar = read("src/components/layout/TopBar.tsx");
  const root = read("src/routes/__root.tsx");

  assert.match(topBar, /to="\/eternum"/, "Expected top nav link to /eternum");
  assert.match(topBar, />\s*Eternum\s*</, "Expected Eternum label in header nav");

  assert.match(
    root,
    /const isEternumRoute = location\.pathname === "\/eternum";/,
    "Expected dedicated full-bleed toggle for Eternum route"
  );
  assert.match(
    root,
    /isBlitzRoute \|\| isEternumRoute[\s\S]*\? "min-h-screen"/,
    "Expected Eternum route to bypass shared page padding"
  );
});
