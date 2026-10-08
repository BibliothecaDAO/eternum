// @vitest-environment node
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { gildIcon, loadKitIconManifest } from "./build-kit-icons.mjs";

const GAME_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), "../..");

/** A master as the art lane delivers one: a subject on a transparent square, here a bright bar over a dark bar. */
const syntheticMaster = () => {
  const size = 400;
  const data = Buffer.alloc(size * size * 4);
  for (let y = 150; y < 250; y += 1)
    for (let x = 100; x < 300; x += 1) {
      const value = y < 200 ? 255 : 30;
      data.set([value, value, value, 255], (y * size + x) * 4);
    }
  return sharp(data, { raw: { width: size, height: size, channels: 4 } })
    .png()
    .toBuffer();
};

const pixelsOf = async (png) => sharp(png).raw().toBuffer({ resolveWithObject: true });

const opaqueBounds = ({ data, info }) => {
  const xs = [];
  for (let i = 3; i < data.length; i += 4) if (data[i] > 16) xs.push(((i - 3) / 4) % info.width);
  return { left: Math.min(...xs), right: Math.max(...xs) };
};

describe("the kit's gilded icons", () => {
  it("sizes the subject to its share of the square, maps its light onto the ramp and rings it with the keyline", async () => {
    const manifest = await loadKitIconManifest();
    const directory = await mkdtemp(join(tmpdir(), "kit-icon-"));
    const master = join(directory, "master.png");
    await sharp(await syntheticMaster()).toFile(master);
    const pixels = await pixelsOf(await gildIcon(master, manifest));
    await rm(directory, { recursive: true });
    const pixelAt = (x, y) => [...pixels.data.subarray((y * 128 + x) * 4, (y * 128 + x) * 4 + 4)];

    expect(pixels.info).toMatchObject({ width: 128, height: 128 });
    // 84% of 128 is 108 px of subject, plus the 2 px keyline on each side.
    const { left, right } = opaqueBounds(pixels);
    expect(right - left + 1).toBe(112);
    // The bright half lands on the ramp's top stop, the dark half near its foot, the edge on the keyline's colour.
    expect(pixelAt(64, 50)).toEqual([255, 240, 194, 255]);
    expect(pixelAt(64, 80)[0]).toBeLessThan(110);
    expect(pixelAt(left, 64)).toEqual([14, 9, 4, 255]);
  });

  it("keeps every published icon as its master makes it today", async () => {
    const manifest = await loadKitIconManifest();
    for (const icon of manifest.icons) {
      const made = await pixelsOf(
        await gildIcon(join(GAME_DIRECTORY, "asset-sources/icons/kit", icon.master), manifest),
      );
      const published = await pixelsOf(
        await readFile(join(GAME_DIRECTORY, manifest.output.directory, `${icon.slug}.png`)),
      );
      expect(published.data.equals(made.data), icon.slug).toBe(true);
    }
  }, 60_000);
});
