// @vitest-environment node
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  measureAppearanceDistance,
  normalizeIconImage,
  readIconAppearanceSignature,
  verifyIconImage,
} from "./icon-image.mjs";
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
  it("publishes every menu icon against the output contract", async () => {
    const manifest = await loadMenuIconManifest();

    await expect(verifyMenuIcons({ imageDirectory: PUBLISHED_MENU_ICON_DIRECTORY })).resolves.toMatchObject({
      count: manifest.icons.length,
    });
  }, 60_000);

  it("normalizes an approved master without changing the published artwork", async () => {
    const outputDirectory = await mkdtemp(join(tmpdir(), "eternum-menu-icons-"));
    try {
      const manifest = await loadMenuIconManifest();
      const [icon] = manifest.icons;
      const outputPath = join(outputDirectory, icon.target);
      await normalizeIconImage(join(APPROVED_MENU_ICON_DIRECTORY, `${icon.slug}.png`), outputPath, manifest.output);
      await verifyIconImage(outputPath, manifest.output);
      const rebuilt = await readIconAppearanceSignature(outputPath);
      const published = await readIconAppearanceSignature(join(PUBLISHED_MENU_ICON_DIRECTORY, icon.target));
      expect(measureAppearanceDistance(rebuilt, published), icon.target).toBeLessThanOrEqual(MAX_APPEARANCE_DISTANCE);
    } finally {
      await rm(outputDirectory, { recursive: true, force: true });
    }
  });
});
