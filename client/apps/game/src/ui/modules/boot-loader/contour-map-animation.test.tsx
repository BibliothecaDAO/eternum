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

    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    expect(html).toMatch(/fill="url\(#.+\)"/);
  });
});
