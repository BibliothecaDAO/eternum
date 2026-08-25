// @vitest-environment node

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ContourMapAnimation } from "./contour-map-animation";

describe("ContourMapAnimation", () => {
  it("uses a distinct vignette gradient id per instance", () => {
    const html = renderToStaticMarkup(
      <>
        <ContourMapAnimation />
        <ContourMapAnimation />
      </>,
    );

    const ids = [...html.matchAll(/<radialGradient id="([^"]+)"/g)].map((match) => match[1]);
    const vignetteIds = ids.filter((id) => id.endsWith("-boot-vignette"));

    expect(ids).toHaveLength(4);
    expect(new Set(ids).size).toBe(4);
    expect(vignetteIds).toHaveLength(2);
    expect(new Set(vignetteIds).size).toBe(2);
    expect(html).toMatch(/fill="url\(#.+\)"/);
  });
});
