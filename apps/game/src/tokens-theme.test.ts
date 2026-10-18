import resolveConfig from "tailwindcss/resolveConfig";
import { describe, expect, it } from "vitest";

import config from "../tailwind.config.js";
import { HUD_LAYERS, HUD_LAYOUT } from "./tokens";

const theme = resolveConfig(config).theme as unknown as Record<string, Record<string, string>>;

describe("the HUD's tokens in the Tailwind theme", () => {
  it("names every HUD layer as a z-hud-<name> class", () => {
    for (const [name, value] of Object.entries(HUD_LAYERS)) expect(theme.zIndex[`hud-${name}`]).toBe(value);
  });

  it("names every HUD size as a hud-<name> spacing", () => {
    for (const [name, value] of Object.entries(HUD_LAYOUT)) expect(theme.spacing[`hud-${name}`]).toBe(value);
  });
});
