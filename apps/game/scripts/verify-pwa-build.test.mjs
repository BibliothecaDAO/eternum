import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PWA_PRECACHE_FILES } from "../build/pwa-assets.mjs";
import { verifyPwaBuild } from "./verify-pwa-build.mjs";
import { test } from "node:test";

const png = (size) => {
  const bytes = Buffer.alloc(24);
  bytes.writeUInt32BE(size, 16);
  bytes.writeUInt32BE(size, 20);
  return bytes;
};

const homeScreenLinks = (sizes) =>
  sizes
    .map(
      (size) =>
        `<link rel="apple-touch-icon" href="/images/game-apple-touch-icon-${size}x${size}.png" sizes="${size}x${size}" />`,
    )
    .join("");

async function writeFixture(dist) {
  await mkdir(join(dist, "images"));
  const entries = [];
  for (const url of PWA_PRECACHE_FILES.filter((file) => file !== "manifest.webmanifest")) {
    const bytes = url.endsWith(".png") ? Buffer.alloc(24) : Buffer.from('<img src="/images/game-pwa-192x192.png">');
    if (url.endsWith(".png")) {
      const size = url.includes("192") ? 192 : 512;
      bytes.writeUInt32BE(size, 16);
      bytes.writeUInt32BE(size, 20);
    }
    await writeFile(join(dist, url), bytes);
    entries.push({ url, revision: createHash("md5").update(bytes).digest("hex") });
  }
  for (const size of [120, 152, 167, 180])
    await writeFile(join(dist, `images/game-apple-touch-icon-${size}x${size}.png`), png(size));
  await writeFile(
    join(dist, "index.html"),
    `<meta name="theme-color" content="#130F0C">${homeScreenLinks([120, 152, 167, 180])}`,
  );
  await writeFile(
    join(dist, "_headers"),
    ["sw.js", "offline.html", "manifest.webmanifest"].map((file) => `/${file}\n  Cache-Control: no-cache`).join("\n"),
  );
  await writeFile(
    join(dist, "manifest.webmanifest"),
    JSON.stringify({
      id: "/",
      scope: "/",
      start_url: "/",
      display: "standalone",
      theme_color: "#130F0C",
      icons: PWA_PRECACHE_FILES.filter((file) => file.endsWith(".png")).map((url) => ({
        src: `/${url}`,
        sizes: url.includes("192") ? "192x192" : "512x512",
        purpose: url.includes("maskable") ? "maskable" : "any",
      })),
    }),
  );
  entries.push({
    url: "manifest.webmanifest",
    revision: createHash("md5")
      .update(await readFile(join(dist, "manifest.webmanifest")))
      .digest("hex"),
  });
  await writeFile(join(dist, "sw.js"), `precache(${JSON.stringify(entries)})`);
  return entries;
}

test("actual worker manifest rejects asset expansion, missing files, stale bytes and offline dependencies", async () => {
  const dist = await mkdtemp(join(tmpdir(), "pwa-build-"));
  try {
    const entries = await writeFixture(dist);
    assert.equal((await verifyPwaBuild(dist)).ok, true);
    for (const changed of [
      entries.slice(1),
      [...entries, { url: "models/new.glb", revision: "abc" }],
      [...entries, entries[0]],
    ]) {
      await writeFile(join(dist, "sw.js"), `precache(${JSON.stringify(changed)})`);
      assert.equal((await verifyPwaBuild(dist)).ok, false);
    }
    await writeFile(join(dist, "sw.js"), `precache(${JSON.stringify(entries)})`);
    await writeFile(join(dist, "offline.html"), '<script src="/assets/main.js"></script>');
    const failures = (await verifyPwaBuild(dist)).failures;
    assert.ok(failures.includes("Stale revision: offline.html"));
    assert.ok(failures.includes("Offline document requires uncached resource: /assets/main.js"));
  } finally {
    await rm(dist, { recursive: true, force: true });
  }
});

test("home-screen icons: one per size iOS asks for, each file at its size", async () => {
  const dist = await mkdtemp(join(tmpdir(), "pwa-build-"));
  try {
    await writeFixture(dist);
    assert.deepEqual((await verifyPwaBuild(dist)).failures, []);
    // The iPad Pro's 167 px icon left off the page.
    await writeFile(
      join(dist, "index.html"),
      `<meta name="theme-color" content="#130F0C">${homeScreenLinks([120, 152, 180])}`,
    );
    assert.deepEqual((await verifyPwaBuild(dist)).failures, ["Home-screen icon sizes: 120,152,180"]);
    // Every size named, one file drawn at another size.
    await writeFile(
      join(dist, "index.html"),
      `<meta name="theme-color" content="#130F0C">${homeScreenLinks([120, 152, 167, 180])}`,
    );
    await writeFile(join(dist, "images/game-apple-touch-icon-152x152.png"), png(180));
    assert.deepEqual((await verifyPwaBuild(dist)).failures, [
      "Wrong home-screen icon: /images/game-apple-touch-icon-152x152.png",
    ]);
  } finally {
    await rm(dist, { recursive: true, force: true });
  }
});
