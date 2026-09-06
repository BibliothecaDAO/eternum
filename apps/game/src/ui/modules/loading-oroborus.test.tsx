// @vitest-environment node

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LoadingOroborus } from "./loading-oroborus";

describe("LoadingOroborus", () => {
  it("renders nothing while the view is stable", () => {
    const html = renderToStaticMarkup(<LoadingOroborus loading={false} />);

    expect(html).toBe("");
  });
});
