// @vitest-environment node
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "vite";
import { afterEach, expect, it } from "vitest";
import { ASSET_LINKS_FILE, assetLinks } from "./asset-links";

const UPLOAD_KEY = Array.from({ length: 32 }, (_, i) => i.toString(16).padStart(2, "0").toUpperCase()).join(":");
const PLAY_SIGNING_KEY = UPLOAD_KEY.replace(/^00/, "FF");

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

/** A client built as players get it, beside an Android app manifest naming `fingerprints`; its statement list, if any. */
async function builtStatements(fingerprints: string[]) {
  const root = await mkdtemp(join(tmpdir(), "asset-links-"));
  roots.push(root);
  const manifest = join(root, "twa-manifest.json");
  const named = fingerprints.map((value, index) => ({ name: `key ${index}`, value }));
  await writeFile(manifest, JSON.stringify({ packageId: "party.realms.play", fingerprints: named }));
  await writeFile(join(root, "index.html"), "<p>Realms</p>");
  await build({ root, logLevel: "silent", configFile: false, plugins: [assetLinks(pathToFileURL(manifest))] });
  const file = join(root, "dist", ASSET_LINKS_FILE);
  return existsSync(file) ? JSON.parse(await readFile(file, "utf8")) : null;
}

it("serves the app's package with both signing keys once its manifest names them", async () => {
  expect(await builtStatements([UPLOAD_KEY, PLAY_SIGNING_KEY])).toEqual([
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: "party.realms.play",
        sha256_cert_fingerprints: [UPLOAD_KEY, PLAY_SIGNING_KEY],
      },
    },
  ]);
});

it("serves nothing before any key is named", async () => {
  expect(await builtStatements([])).toBeNull();
});

it("fails the build on a key list it would be wrong to serve", async () => {
  await expect(builtStatements([UPLOAD_KEY])).rejects.toThrow("Play App Signing key");
  await expect(builtStatements([UPLOAD_KEY, UPLOAD_KEY])).rejects.toThrow("Play App Signing key");
  await expect(builtStatements([UPLOAD_KEY, PLAY_SIGNING_KEY.toLowerCase()])).rejects.toThrow("not SHA-256");
  await expect(builtStatements([UPLOAD_KEY, "TODO"])).rejects.toThrow("not SHA-256");
});
