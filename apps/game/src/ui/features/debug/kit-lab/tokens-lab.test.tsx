import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { COLORS, RADII, TEXT_SHADOWS, TYPE, WIDTHS } from "@/tokens";

import { TokensLab } from "./tokens-lab";

const page = () => new DOMParser().parseFromString(renderToStaticMarkup(<TokensLab />), "text/html").body;

describe("tokens lab", () => {
  it("draws every colour, type step, radius, title shadow and width from the token file", () => {
    const text = page().textContent ?? "";
    for (const [name, value] of Object.entries(COLORS)) expect(text).toContain(`${name} ${value}`);
    for (const name of Object.keys(TYPE)) expect(text).toContain(`text-${name}`);
    for (const name of Object.keys(RADII)) expect(text).toContain(`rounded-${name}`);
    for (const name of Object.keys(TEXT_SHADOWS)) expect(text).toContain(`text-shadow-${name}`);
    for (const name of Object.keys(WIDTHS)) expect(text).toContain(`w-${name}`);
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
