import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("PlayView live games dev visibility", () => {
  it("wires forge callback in the live ongoing grid", () => {
    const source = readFileSync(resolve(process.cwd(), "src/ui/features/landing/views/play-view.tsx"), "utf8");
    const liveStart = source.indexOf("{/* Live Games Column */}");
    const upcomingStart = source.indexOf("{/* Upcoming Games Column */}");
    const ongoingBlock = source.slice(liveStart, upcomingStart);

    expect(liveStart).toBeGreaterThan(-1);
    expect(upcomingStart).toBeGreaterThan(liveStart);
    expect(ongoingBlock).toContain("onForgeHyperstructures={onForgeHyperstructures}");
  });

  it("does not hard-filter the live ongoing grid to production only", () => {
    const source = readFileSync(resolve(process.cwd(), "src/ui/features/landing/views/play-view.tsx"), "utf8");
    const liveStart = source.indexOf("{/* Live Games Column */}");
    const upcomingStart = source.indexOf("{/* Upcoming Games Column */}");
    const ongoingBlock = source.slice(liveStart, upcomingStart);

    expect(liveStart).toBeGreaterThan(-1);
    expect(upcomingStart).toBeGreaterThan(liveStart);
    expect(ongoingBlock).not.toContain("devModeFilter={false}");
  });
});
