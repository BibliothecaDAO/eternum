import { describe, expect, it } from "vitest";
import { markShadowCastersChanged, ShadowRefreshPolicy } from "./shadow-refresh-policy";

describe("ShadowRefreshPolicy", () => {
  it("refreshes once for a caster change instead of polling forever", () => {
    const policy = new ShadowRefreshPolicy();

    expect(policy.consumeRefresh(0, 100)).toBe(true);
    expect(policy.consumeRefresh(1_000, 100)).toBe(false);

    markShadowCastersChanged();
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

  it("refreshes moving light transforms in the same frame while coalescing static content", () => {
    const policy = new ShadowRefreshPolicy();
    policy.consumeRefresh(0, 250);

    policy.observeSun([1, 2, 3]);
    markShadowCastersChanged();
    expect(policy.consumeRefresh(16, 250)).toBe(true);

    policy.observeSun([1.01, 2, 3]);
    expect(policy.consumeRefresh(16, 250)).toBe(true);
    markShadowCastersChanged();
    expect(policy.consumeRefresh(16, 250)).toBe(false);
    expect(policy.consumeRefresh(250, 250)).toBe(true);
    expect(policy.consumeRefresh(250, 250)).toBe(false);
  });

  it("draws each scene's shadow again once for a caster changed anywhere", () => {
    const worldMap = new ShadowRefreshPolicy();
    const realm = new ShadowRefreshPolicy();
    worldMap.consumeRefresh(0, 100);
    realm.consumeRefresh(0, 100);

    markShadowCastersChanged();
    expect(worldMap.consumeRefresh(100, 100)).toBe(true);
    expect(worldMap.consumeRefresh(100, 100)).toBe(false);
    expect(realm.consumeRefresh(100, 100)).toBe(true);
    expect(realm.consumeRefresh(100, 100)).toBe(false);
  });
});
