// @vitest-environment node

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LoadingOroborus } from "./loading-oroborus";

describe("LoadingOroborus", () => {
  it("does not render the animated loader when the overlay is hidden", () => {
    const html = renderToStaticMarkup(<LoadingOroborus loading={false} />);

    expect(html).not.toContain("Charting the World");
    expect(html).not.toContain("boot-loader-segment-indeterminate");
  });
});
