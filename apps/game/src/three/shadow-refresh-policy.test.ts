import { describe, expect, it } from "vitest";
import { ShadowRefreshPolicy } from "./shadow-refresh-policy";

describe("ShadowRefreshPolicy", () => {
  it("refreshes once for a content change instead of polling forever", () => {
    const policy = new ShadowRefreshPolicy();

    expect(policy.consumeRefresh(0, 100)).toBe(true);
    expect(policy.consumeRefresh(1_000, 100)).toBe(false);

    policy.markContentChanged();
    expect(policy.consumeRefresh(0, 100)).toBe(true);
    expect(policy.consumeRefresh(1_000, 100)).toBe(false);
  });

  it("refreshes when the camera enters a different cell", () => {
    const policy = new ShadowRefreshPolicy();
    policy.consumeRefresh(0, 100);

    policy.markCameraCell(12, 18);
    expect(policy.consumeRefresh(100, 100)).toBe(true);

    policy.markCameraCell(12, 18);
    expect(policy.consumeRefresh(100, 100)).toBe(false);

    policy.markCameraCell(13, 18);
    expect(policy.consumeRefresh(0, 100)).toBe(true);
  });

  it("coalesces sun and content changes behind the profile refresh floor", () => {
    const policy = new ShadowRefreshPolicy();
    policy.consumeRefresh(0, 250);

    policy.observeSun([1, 2, 3]);
    policy.markContentChanged();
    expect(policy.consumeRefresh(100, 250)).toBe(false);

    policy.observeSun([1.01, 2, 3]);
    expect(policy.consumeRefresh(150, 250)).toBe(true);
    expect(policy.consumeRefresh(250, 250)).toBe(false);
  });
});
