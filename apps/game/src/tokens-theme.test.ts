import resolveConfig from "tailwindcss/resolveConfig";
import { describe, expect, it } from "vitest";

import config from "../tailwind.config.js";
import {
  APP_SHEET,
  APP_TYPE,
  appVariables,
  HUD_DERIVED,
  HUD_LAYERS,
  HUD_LAYOUT,
  HUD_TYPE,
  hudModeVariables,
  hudVariables,
} from "./tokens";

const theme = resolveConfig(config).theme as unknown as Record<string, Record<string, string>>;

describe("the HUD's tokens in the Tailwind theme", () => {
  it("names every HUD layer as a z-hud-<name> class", () => {
    for (const [name, value] of Object.entries(HUD_LAYERS)) expect(theme.zIndex[`hud-${name}`]).toBe(value);
  });

  it("names every HUD size as a hud-<name> spacing", () => {
    for (const [name, value] of Object.entries(HUD_LAYOUT)) expect(theme.spacing[`hud-${name}`]).toBe(value);
  });
});

describe("the sheets' CSS variables", () => {
  it("keep an edge's colour and a type role's leading apart, though both are named for strong", () => {
    const app = appVariables();
    expect([app["--app-line-strong"], app["--app-leading-strong"]]).toEqual([
      APP_SHEET["line-strong"],
      APP_TYPE.strong.line,
    ]);
    // The HUD's root takes the sheet's variables and then a mode's: no name may be written by both.
    const hud = hudVariables();
    const mode = hudModeVariables("blitz");
    expect(Object.keys(hud).filter((name) => name in mode)).toEqual([]);
    expect([mode["--hud-line-strong"], hud["--hud-leading-strong"]]).toEqual([
      HUD_DERIVED["line-strong"],
      HUD_TYPE.strong.line,
    ]);
  });
});
