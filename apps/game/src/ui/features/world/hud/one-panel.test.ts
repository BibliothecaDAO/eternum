import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** What draws a panel's frame or title itself, instead of being the sheet's HudPanel: the overlay surface, a rounded box. */
const OWN_FRAME = /OVERLAY_SURFACE_BASE|\brounded-(?:xl|2xl)\b|hud-plate|hud-panel-title|hud-card-title/g;

it("draws every panel of the HUD as the one HUD panel (HudPanel), never a frame or title of its own", () => {
  const own = readdirSync(__dirname)
    .filter((name) => /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name))
    .flatMap((name) =>
      [...readFileSync(join(__dirname, name), "utf8").matchAll(OWN_FRAME)].map((match) => `${name}: ${match[0]}`),
    );
  expect(own).toEqual([]);
});
