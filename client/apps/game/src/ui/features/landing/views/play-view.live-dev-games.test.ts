import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const PLAY_VIEW_SOURCE_PATH = resolve(process.cwd(), "src/ui/features/landing/views/play-view.tsx");

const readPlayViewSource = () => readFileSync(PLAY_VIEW_SOURCE_PATH, "utf8");

const getSourceBlock = (source: string, startMarker: string, endMarker: string) => {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);

  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);

  return source.slice(start, end);
};

describe("PlayView live games dev visibility", () => {
  it("wires forge callback in the open games grid", () => {
    const source = readPlayViewSource();
    const openBlock = getSourceBlock(source, "{/* Open Games Column */}", "{/* Played Column (ended games) */}");

    expect(openBlock).toContain("onForgeHyperstructures={onForgeHyperstructures}");
  });

  it("wires forge callback in learn tab practice games", () => {
    const source = readPlayViewSource();
    const practiceBlock = getSourceBlock(
      source,
      "{/* Row 2: Practice Games (full width) */}",
      "const landingFeatureIcons",
    );

    expect(practiceBlock).toContain("onForgeHyperstructures={onForgeHyperstructures}");
  });

  it("does not hard-filter the open games grid to production only", () => {
    const source = readPlayViewSource();
    const openBlock = getSourceBlock(source, "{/* Open Games Column */}", "{/* Played Column (ended games) */}");

    expect(openBlock).not.toContain("devModeFilter={false}");
  });
});
