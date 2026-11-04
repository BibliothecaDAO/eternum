import { describe, expect, it, vi } from "vitest";

describe("what waits for the first view", () => {
  it("runs once the world is interactive, in the order asked, and at once after", async () => {
    const { afterWorldInteractive, isWorldInteractive, markWorldInteractive } = await import("./world-interactive");
    const ran: string[] = [];
    afterWorldInteractive(() => ran.push("music"));
    afterWorldInteractive(() => ran.push("weather"));
    expect(isWorldInteractive()).toBe(false);
    expect(ran).toEqual([]);

    markWorldInteractive();
    expect(ran).toEqual(["music", "weather"]);

    const late = vi.fn();
    afterWorldInteractive(late);
    expect(late).toHaveBeenCalledTimes(1);
    // Marked again (a second hand-off on the same page), nothing runs twice.
    markWorldInteractive();
    expect(ran).toEqual(["music", "weather"]);
  });
});
