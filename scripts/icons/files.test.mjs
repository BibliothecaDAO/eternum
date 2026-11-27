import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import sharp from "sharp";
import { validateIconFiles } from "./files.mjs";
import { normalizeMaster, deliverIcon } from "./normalize.mjs";

test("realm icon comparisons show renders of the current level models", async () => {
  const game = new URL("../../apps/game/", import.meta.url);
  const references = JSON.parse(
    await readFile(new URL("asset-sources/facets/realm-model-references.json", game), "utf8"),
  );
  const kitSource = Buffer.concat([
    await readFile(new URL("src/three/structures/base-realm-kit.ts", game)),
    await readFile(new URL("src/three/structures/realm-kit-primitives.ts", game)),
  ]);
  const kitSha256 = createHash("sha256").update(kitSource).digest("hex");
  assert.deepEqual(
    references.map(({ level }) => level),
    [0, 1, 2, 3],
  );
  for (const reference of references) {
    assert.equal(reference.model, `procedural:base-realm:${reference.level}`);
    assert.equal(kitSha256, reference.modelSha256, `Refresh realm ${reference.level} model reference`);
    const promptText = await readFile(
      new URL(`asset-sources/facets/prompts/realm-${reference.level}.txt`, game),
      "utf8",
    );
    assert.ok(
      promptText.includes(`Model reference: ${reference.model}.`),
      `Refresh realm ${reference.level} prompt model reference`,
    );
    const renderBytes = await readFile(new URL(`asset-sources${reference.render}`, game));
    assert.equal(
      createHash("sha256").update(renderBytes).digest("hex"),
      reference.renderSha256,
      `Refresh realm ${reference.level} render reference`,
    );
  }
});

test("the build file check rejects missing masters, missing exports and a delivery that differs from its master", async () => {
  const root = await mkdtemp(join(tmpdir(), "facets-files-"));
  const icons = [{ id: "production" }];
  try {
    await assert.rejects(validateIconFiles(icons, root, root), /masters\/production.png/);
    await mkdir(join(root, "masters"));
    const artwork = Buffer.from(
      '<svg width="100" height="100"><rect x="5" y="5" width="90" height="90" fill="red"/></svg>',
    );
    await sharp(artwork).png().toFile(join(root, "masters/production.png"));
    const master = await normalizeMaster(join(root, "masters/production.png"));
    for (const size of [64, 128, 256]) {
      await assert.rejects(validateIconFiles(icons, root, root), new RegExp(`${size}/production.webp`));
      await mkdir(join(root, String(size)));
      await writeFile(join(root, String(size), "production.webp"), await deliverIcon(master, size, "production"));
    }
    await assert.doesNotReject(validateIconFiles(icons, root, root));
    const delivered = await readFile(join(root, "128/production.webp"));
    await writeFile(join(root, "128/production.webp"), await sharp(delivered).webp({ quality: 60 }).toBuffer());
    await assert.rejects(validateIconFiles(icons, root, root), /Stale production delivery: .*128\/production.webp/);
    await writeFile(join(root, "128/production.webp"), delivered);
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
