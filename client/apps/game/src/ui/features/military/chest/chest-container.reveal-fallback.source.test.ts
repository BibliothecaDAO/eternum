// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("ChestContainer reveal fallback", () => {
  it("queries immutable event history after a bounded live-event wait", () => {
    const source = readFileSync(resolve(process.cwd(), "src/ui/features/military/chest/chest-container.tsx"), "utf8");

    expect(source).toContain("REVEAL_FALLBACK_MS = 10_000");
    expect(source).toContain("fetchOpenRelicChestEvent");
    expect(source).toContain("if (!hasMatchingEvent.current) scheduleChestRevealFallback()");
    expect(source).toContain("setIsOpening(false)");
    expect(source).toContain("Retry reveal");
  });
});
