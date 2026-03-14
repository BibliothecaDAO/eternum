import { describe, expect, it } from "vitest";

import { resolvePathReadabilityPolicy } from "./path-readability-policy";

describe("resolvePathReadabilityPolicy", () => {
  it("keeps close-view opacity aligned with the stock line baseline", () => {
    expect(
      resolvePathReadabilityPolicy({
        displayState: "selected",
        view: "close",
      }),
    ).toEqual({
      endpointEmphasis: true,
      opacity: 0.8,
    });
  });

  it("raises the readability floor for medium and far tactical views", () => {
    expect(
      resolvePathReadabilityPolicy({
        displayState: "moving",
        view: "medium",
      }),
    ).toEqual({
      endpointEmphasis: true,
      opacity: 0.7,
    });

    expect(
      resolvePathReadabilityPolicy({
        displayState: "preview",
        view: "far",
      }),
    ).toEqual({
      endpointEmphasis: true,
      opacity: 0.45,
    });
  });

  it("preserves lower-emphasis hover readability without dropping below the far-view minimum", () => {
    expect(
      resolvePathReadabilityPolicy({
        displayState: "hover",
        view: "far",
      }),
    ).toEqual({
      endpointEmphasis: false,
      opacity: 0.5,
    });
  });
});
