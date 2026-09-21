// @vitest-environment node
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { buildMenuIcons } from "./build-menu-icons.mjs";
import { measureAppearanceDistance, readIconAppearanceSignature } from "./icon-image.mjs";
import {
  APPROVED_MENU_ICON_DIRECTORY,
  loadMenuIconManifest,
  PUBLISHED_MENU_ICON_DIRECTORY,
} from "./menu-icon-manifest.mjs";
import { verifyMenuIcons } from "./verify-menu-icons.mjs";

// Platform resampling noise measures under 0.4, a one-pixel subject shift measures 5 and a swapped
// icon measures 57, so this threshold convicts a real regression without convicting the CI runner.
const MAX_APPEARANCE_DISTANCE = 1;

describe("menu icon pipeline", () => {
  it("maps each approved semantic icon to its stable public path", async () => {
    const manifest = await loadMenuIconManifest();

    expect(Object.fromEntries(manifest.icons.map(({ slug, target }) => [slug, target]))).toMatchObject({
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

  it("publishes every menu icon against the output contract", async () => {
    const manifest = await loadMenuIconManifest();

    await expect(verifyMenuIcons({ imageDirectory: PUBLISHED_MENU_ICON_DIRECTORY })).resolves.toMatchObject({
      count: manifest.icons.length,
    });
  }, 60_000);

  // Rebuilding the complete UI family now processes more than eighty masters.
  it("rebuilds the published menu set from approved masters", async () => {
    const outputDirectory = await mkdtemp(join(tmpdir(), "eternum-menu-icons-"));
    const manifest = await loadMenuIconManifest();

    await buildMenuIcons({ inputDirectory: APPROVED_MENU_ICON_DIRECTORY, outputDirectory });
    await expect(verifyMenuIcons({ imageDirectory: outputDirectory })).resolves.toMatchObject({
      count: manifest.icons.length,
    });
    for (const icon of manifest.icons) {
      const rebuilt = await readIconAppearanceSignature(join(outputDirectory, icon.target));
      const published = await readIconAppearanceSignature(join(PUBLISHED_MENU_ICON_DIRECTORY, icon.target));
      expect(measureAppearanceDistance(rebuilt, published), icon.target).toBeLessThanOrEqual(MAX_APPEARANCE_DISTANCE);
    }
  }, 60_000);
});
