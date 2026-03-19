import { describe, expect, it } from "vitest";
import { createGameRendererMemoryGlobalsFixture } from "./game-renderer-memory-globals-fixture";

describe("GameRenderer memory globals", () => {
  it("clears memory monitor globals during destroy", () => {
    const fixture = createGameRendererMemoryGlobalsFixture();

    fixture.setup();

    expect(fixture.debugWindow.__gameRenderer).toBeDefined();
    expect(fixture.debugWindow.__memoryMonitorRenderer).toBeDefined();

    fixture.destroy();

    expect(fixture.debugWindow.__gameRenderer).toBeUndefined();
    expect(fixture.debugWindow.__memoryMonitorRenderer).toBeUndefined();
  });
});
