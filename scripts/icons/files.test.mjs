import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import sharp from "sharp";
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
      const directory = kind === "model" ? "public" : "asset-sources";
      const bytes = await readFile(new URL(`${directory}${reference[kind]}`, game));
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
    const artwork = Buffer.from(
      '<svg width="100" height="100"><rect x="5" y="5" width="90" height="90" fill="red"/></svg>',
    );
    await sharp(artwork).png().toFile(join(root, "masters/production.png"));
    for (const size of [64, 128, 256]) {
      await assert.rejects(validateIconFiles(icons, root, root), new RegExp(`${size}/production.webp`));
      await mkdir(join(root, String(size)));
      await sharp(artwork)
        .resize(size, size)
        .webp()
        .toFile(join(root, String(size), "production.webp"));
    }
    await assert.doesNotReject(validateIconFiles(icons, root, root));
    await writeFile(join(root, "64/production.webp"), "not an image");
    await assert.rejects(validateIconFiles(icons, root, root), /unsupported image format/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("LORDS keeps the verified official token bytes and no painted deliveries", async () => {
  const game = new URL("../../apps/game/", import.meta.url);
  const verdicts = JSON.parse(await readFile(new URL("asset-sources/facets/verdicts.json", game), "utf8"));
  const token = await readFile(new URL("public/tokens/lords.svg", game));
  assert.equal(createHash("sha256").update(token).digest("hex"), verdicts["official/lords"].sha256);
  for (const file of [
    "public/tokens/lords.png",
    "asset-sources/facets/masters/lords.png",
    "asset-sources/facets/prompts/lords.txt",
    ...[64, 128, 256].map((size) => `public/icons/facets/${size}/lords.webp`),
  ]) {
    await assert.rejects(readFile(new URL(file, game)), { code: "ENOENT" });
  }
});
