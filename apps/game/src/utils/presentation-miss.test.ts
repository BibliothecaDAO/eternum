import { afterEach, describe, expect, it, vi } from "vitest";

import { presentOrSkip } from "./presentation-miss";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("an entity whose presentation cannot be built", () => {
  it("is left out and named in the console, without stopping the loop that met it", () => {
    vi.useFakeTimers();
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const missed: number[] = [];
    const drawn = [1, 7, 9].map((id) =>
      presentOrSkip(
        "Structure",
        id,
        () => {
          if (id === 7) throw new Error("Unknown mine kind 0");
          return { id };
        },
        () => missed.push(id),
      ),
    );
    expect(missed).toEqual([7]);
    expect(drawn).toEqual([{ id: 1 }, undefined, { id: 9 }]);
    expect(errors).toHaveBeenCalledWith("presentation_miss", {
      model: "Structure",
      entityId: 7,
      error: "Unknown mine kind 0",
    });
    // In development the miss is also an uncaught error, on its own turn.
    expect(() => vi.runAllTimers()).toThrow("Structure 7 is not drawn: Unknown mine kind 0");
  });
});
