import { beforeEach, describe, expect, it, vi } from "vitest";

describe("game-review-storage", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("stores and reads dismissal from localStorage", async () => {
    const { isGameReviewDismissed, setGameReviewDismissed } = await import("./game-review-storage");
    const worldAddress = "0x00123";

    expect(isGameReviewDismissed("slot", worldAddress)).toBe(false);

    setGameReviewDismissed("slot", worldAddress);

    expect(isGameReviewDismissed("slot", "0x123")).toBe(true);

    const persisted = localStorage.getItem("eternum:review:dismissed");
    expect(persisted).not.toBeNull();
    expect(JSON.parse(persisted as string)).toEqual({
      "slot:0x123": 1,
    });
  });

  it("keeps dismissal in memory when localStorage access fails", async () => {
    const { isGameReviewDismissed, setGameReviewDismissed } = await import("./game-review-storage");
    const worldAddress = "0x123";

    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });

    setGameReviewDismissed("slot", worldAddress);

    expect(isGameReviewDismissed("slot", worldAddress)).toBe(true);
  });
});
