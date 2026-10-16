import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { validateIconFiles } from "./files.mjs";

test("realm icon comparisons show renders of the current level models", async () => {
  const game = new URL("../../apps/game/", import.meta.url);
  const references = JSON.parse(
    await readFile(new URL("asset-sources/facets/realm-model-references.json", game), "utf8"),
  );
  const assets = JSON.parse(await readFile(new URL("src/three/structures/realm-assets.json", game), "utf8"));
  assert.deepEqual(
    references.map(({ level }) => level),
    [0, 1, 2, 3],
  );
  for (const reference of references) {
    assert.equal(reference.model, assets.find((asset) => asset.level === reference.level && !asset.wonder).path);
    for (const kind of ["model", "render"]) {
      const bytes = await readFile(new URL(`public${reference[kind]}`, game));
      assert.equal(
        createHash("sha256").update(bytes).digest("hex"),
        reference[`${kind}Sha256`],
        `Refresh realm ${reference.level} ${kind} reference`,
      );
    }
  }
});

test("the build file check rejects missing masters and exports", async () => {
  const root = await mkdtemp(join(tmpdir(), "facets-files-"));
  const icons = [{ id: "production" }];
  try {
    await assert.rejects(validateIconFiles(icons, root, root), /masters\/production.png/);
    await mkdir(join(root, "masters"));
    await writeFile(join(root, "masters/production.png"), "fixture");
    for (const size of [64, 128, 256]) {
      await assert.rejects(validateIconFiles(icons, root, root), new RegExp(`${size}/production.webp`));
      await mkdir(join(root, String(size)));
      await writeFile(join(root, String(size), "production.webp"), "fixture");
    }
    await assert.doesNotReject(validateIconFiles(icons, root, root));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("LORDS keeps the verified official token bytes and no painted deliveries", async () => {
  const game = new URL("../../apps/game/", import.meta.url);
  const verdicts = JSON.parse(await readFile(new URL("asset-sources/facets/verdicts.json", game), "utf8"));
  const token = await readFile(new URL("public/tokens/lords.png", game));
  assert.equal(createHash("sha256").update(token).digest("hex"), verdicts["official/lords"].sha256);
  for (const file of [
    "asset-sources/facets/masters/lords.png",
    "asset-sources/facets/prompts/lords.txt",
    ...[64, 128, 256].map((size) => `public/icons/facets/${size}/lords.webp`),
  ]) {
    await assert.rejects(readFile(new URL(file, game)), { code: "ENOENT" });
  }
});
