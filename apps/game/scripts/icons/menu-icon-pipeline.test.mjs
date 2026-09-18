// @vitest-environment node
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { buildMenuIcons } from "./build-menu-icons.mjs";
import {
  APPROVED_MENU_ICON_DIRECTORY,
  loadMenuIconManifest,
  PUBLISHED_MENU_ICON_DIRECTORY,
} from "./menu-icon-manifest.mjs";
import { verifyMenuIcons } from "./verify-menu-icons.mjs";

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

  it("rebuilds the published menu set byte-for-byte from approved masters", async () => {
    const outputDirectory = await mkdtemp(join(tmpdir(), "eternum-menu-icons-"));
    const manifest = await loadMenuIconManifest();

    await buildMenuIcons({ inputDirectory: APPROVED_MENU_ICON_DIRECTORY, outputDirectory });
    await expect(verifyMenuIcons({ imageDirectory: outputDirectory })).resolves.toMatchObject({ count: 9 });
    for (const icon of manifest.icons) {
      await expect(readFile(join(outputDirectory, icon.target))).resolves.toEqual(
        await readFile(join(PUBLISHED_MENU_ICON_DIRECTORY, icon.target)),
      );
    }
  });
});
