// @vitest-environment node
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { buildMenuIcons } from "./build-menu-icons.mjs";
import {
  APPROVED_MENU_ICON_DIRECTORY,
  loadMenuIconManifest,
  PUBLISHED_MENU_ICON_DIRECTORY,
} from "./menu-icon-manifest.mjs";
import { verifyMenuIcons } from "./verify-menu-icons.mjs";

// sharp/libvips produces a 2.14 RMSE for transfer.png between macOS and Linux Lanczos resampling.
const MAX_PLATFORM_PIXEL_RMSE = 3;

describe("menu icon pipeline", () => {
  it("maps each approved semantic icon to its stable public path", async () => {
    const manifest = await loadMenuIconManifest();

    expect(Object.fromEntries(manifest.icons.map(({ slug, target }) => [slug, target]))).toEqual({
      automation: "robot.png",
      build: "construction.png",
      guild: "guild.png",
      military: "military.png",
      production: "production.png",
      settings: "settings.png",
      trade: "trade.png",
      transfer: "transfer.png",
      world: "world.png",
    });
  });

  it("rebuilds the published menu set from approved masters", async () => {
    const outputDirectory = await mkdtemp(join(tmpdir(), "eternum-menu-icons-"));
    const manifest = await loadMenuIconManifest();

    await buildMenuIcons({ inputDirectory: APPROVED_MENU_ICON_DIRECTORY, outputDirectory });
    await expect(verifyMenuIcons({ imageDirectory: outputDirectory })).resolves.toMatchObject({ count: 9 });
    for (const icon of manifest.icons) {
      const generated = await readIconPixels(join(outputDirectory, icon.target));
      const published = await readIconPixels(join(PUBLISHED_MENU_ICON_DIRECTORY, icon.target));
      expect(generated.info).toEqual(published.info);
      expect(calculatePixelRmse(generated.data, published.data), icon.target).toBeLessThanOrEqual(
        MAX_PLATFORM_PIXEL_RMSE,
      );
    }
  });
});

async function readIconPixels(path) {
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, info };
}

function calculatePixelRmse(actual, expected) {
  let squaredError = 0;
  for (let index = 0; index < actual.length; index += 1) {
    const difference = actual[index] - expected[index];
    squaredError += difference * difference;
  }
  return Math.sqrt(squaredError / actual.length);
}
