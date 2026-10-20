import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import sharp from "sharp";
import { assertIconFill, normalizeMaster, deliverIcon } from "./normalize.mjs";

test("the shipped undersized hammer is rejected and its normalized subject fills every delivery", async () => {
  const original = await readFile(new URL("./fixtures/undersized-hammer.webp", import.meta.url));
  await assert.rejects(assertIconFill(original, "old hammer"), /Undersized icon old hammer/);
  const normalized = await normalizeMaster(original);
  for (const size of [64, 128, 256]) {
    const image = await sharp(normalized)
      .resize(size, size)
      .webp({ quality: 90, alphaQuality: 100, effort: 6 })
      .toBuffer();
    const { fill } = await assertIconFill(image, `hammer/${size}`);
    assert.ok(fill >= 0.85 && fill <= 0.92, `unexpected subject fill ${fill}`);
  }
});

test("faint pixels cannot make a small subject pass the fill check", async () => {
  const image = await sharp(
    Buffer.from(
      '<svg width="100" height="100"><rect width="100" height="100" fill="white" opacity="0.03"/><rect x="35" y="35" width="30" height="30" fill="red"/></svg>',
    ),
  )
    .png()
    .toBuffer();
  await assert.rejects(assertIconFill(image, "faint border"), /30.0% subject fill/);
  const { fill } = await assertIconFill(await normalizeMaster(image));
  assert.ok(fill >= 0.85);
});

test("isolated specks in the live stone source cannot shrink its delivered subject", async () => {
  const source = await readFile(
    new URL("../../apps/game/asset-sources/lab/rss-icons/history/stone.png", import.meta.url),
  );
  const master = await normalizeMaster(source);
  for (const size of [64, 128, 256]) {
    const { fill } = await assertIconFill(await deliverIcon(master, size, "live stone"));
    assert.ok(fill >= 0.85 && fill <= 0.92);
  }
});

test("the completed tower's diagonal subject remains readable at each delivery size", async () => {
  const source = await readFile(
    new URL("../../apps/game/asset-sources/facets/masters/hyperstructure.png", import.meta.url),
  );
  const master = await normalizeMaster(source);
  for (const size of [64, 128, 256]) {
    const { fill } = await assertIconFill(await deliverIcon(master, size, "built tower"));
    assert.ok(fill >= 0.85 && fill <= 0.92);
  }
});
