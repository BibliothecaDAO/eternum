import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("PlayView live games dev visibility", () => {
  it("does not wire a legacy forge callback in the open games grid", () => {
    const source = readFileSync(resolve(process.cwd(), "src/ui/features/landing/views/play-view.tsx"), "utf8");
    const openStart = source.indexOf("{/* Open Games Column */}");
    const playedStart = source.indexOf("{/* Played Column (ended games) */}");
    const openBlock = source.slice(openStart, playedStart);

    expect(openStart).toBeGreaterThan(-1);
    expect(playedStart).toBeGreaterThan(openStart);
    expect(openBlock).not.toContain("onForgeHyperstructures");
  });

  it("does not wire a legacy forge callback in learn tab practice games", () => {
    const source = readFileSync(resolve(process.cwd(), "src/ui/features/landing/views/play-view.tsx"), "utf8");
    const practiceStart = source.indexOf("{/* Row 2: Practice Games (full width) */}");
    const footerCommentStart = source.indexOf("/**\n * Get icon and color for feature type");
    const practiceBlock = source.slice(practiceStart, footerCommentStart);

    expect(practiceStart).toBeGreaterThan(-1);
    expect(footerCommentStart).toBeGreaterThan(practiceStart);
    expect(practiceBlock).not.toContain("onForgeHyperstructures");
  });

  it("does not hard-filter the open games grid to production only", () => {
    const source = readFileSync(resolve(process.cwd(), "src/ui/features/landing/views/play-view.tsx"), "utf8");
    const openStart = source.indexOf("{/* Open Games Column */}");
    const playedStart = source.indexOf("{/* Played Column (ended games) */}");
    const openBlock = source.slice(openStart, playedStart);

    expect(openStart).toBeGreaterThan(-1);
    expect(playedStart).toBeGreaterThan(openStart);
    expect(openBlock).not.toContain("devModeFilter={false}");
  });
});
