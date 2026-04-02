import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SegmentedBracketLoader, resolveDeterminateSegmentCount } from "./segmented-bracket-loader";

describe("resolveDeterminateSegmentCount", () => {
  it("clamps progress into the segment range", () => {
    expect(resolveDeterminateSegmentCount(-10, 8)).toBe(0);
    expect(resolveDeterminateSegmentCount(0, 8)).toBe(0);
    expect(resolveDeterminateSegmentCount(50, 8)).toBe(4);
    expect(resolveDeterminateSegmentCount(100, 8)).toBe(8);
    expect(resolveDeterminateSegmentCount(120, 8)).toBe(8);
  });
});

describe("SegmentedBracketLoader", () => {
  it("renders the requested number of segments", () => {
    const html = renderToStaticMarkup(<SegmentedBracketLoader mode="determinate" progress={50} segments={8} />);

    expect(html.match(/data-filled="true"/g)?.length ?? 0).toBe(4);
    expect(html.match(/data-filled="false"/g)?.length ?? 0).toBe(4);
  });

  it("renders indeterminate segments without requiring progress", () => {
    const html = renderToStaticMarkup(<SegmentedBracketLoader mode="indeterminate" segments={6} />);

    expect(html).toContain('data-mode="indeterminate"');
    expect(html.match(/boot-loader-segment-indeterminate/g)?.length ?? 0).toBe(6);
  });
});
