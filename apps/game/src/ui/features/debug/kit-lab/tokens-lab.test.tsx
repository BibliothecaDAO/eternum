import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { HUD_COLORS, HUD_FINISH, RADII, SHELL_COLORS, SHELL_FINISH, SPACING, TYPE, WIDTHS } from "@/tokens";

import { TokensLab } from "./tokens-lab";

const page = () => new DOMParser().parseFromString(renderToStaticMarkup(<TokensLab />), "text/html").body;

describe("tokens lab", () => {
  it("draws both palettes, every type step, spacing step, radius and width from the token file", () => {
    const body = page();
    const text = body.textContent ?? "";
    for (const [surface, colors] of [
      ["shell", SHELL_COLORS],
      ["hud", HUD_COLORS],
    ] as const) {
      const palette = body.querySelector(`[data-palette="${surface}"]`)?.textContent ?? "";
      for (const [name, value] of Object.entries(colors)) expect(palette).toContain(`${name} ${value}`);
    }
    for (const name of Object.keys(TYPE)) expect(text).toContain(`text-${name}`);
    for (const [name, value] of Object.entries(SPACING)) expect(text).toContain(`p-${name} ${value}`);
    for (const name of Object.keys(RADII)) expect(text).toContain(`rounded-${name}`);
    for (const name of Object.keys(WIDTHS)) expect(text).toContain(`w-${name}`);
  });

  it("draws every finish value of both surfaces: gradients, shadows, ornament and the shared classes'", () => {
    const text = page().textContent ?? "";
    for (const [surface, finish] of [
      ["shell", SHELL_FINISH],
      ["hud", HUD_FINISH],
    ] as const)
      for (const [group, values] of Object.entries(finish))
        for (const [name, value] of Object.entries(values))
          expect(text).toContain(`${surface} ${group}.${name} ${value}`);
  });

  it("samples each type step at its own size, with its line-height where the step has one", () => {
    const body = page();
    const caption = body.querySelector<HTMLElement>('[data-type-step="caption"] .font-body');
    const figure = body.querySelector<HTMLElement>('[data-type-step="figure"] .font-display');
    expect(caption?.style.fontSize).toBe("14px");
    expect(caption?.style.lineHeight).toBe("20px");
    expect(figure?.style.fontSize).toBe("64px");
    expect(figure?.style.lineHeight).toBe("");
  });
});
