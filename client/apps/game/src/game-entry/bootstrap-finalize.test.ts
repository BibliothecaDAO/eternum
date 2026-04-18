// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { finalizeBootstrapSession } from "./bootstrap-finalize";

describe("finalizeBootstrapSession", () => {
  it("commits ready before awaiting the policy refresh so boot isn't blocked by keychain rotation", async () => {
    const commitReady = vi.fn();
    const events: string[] = [];

    let releaseRefresh: () => void = () => {};
    const refreshPromise = new Promise<boolean>((resolve) => {
      releaseRefresh = () => resolve(true);
    });
    const refreshPolicies = vi.fn(async () => {
      events.push("refresh-start");
      const outcome = await refreshPromise;
      events.push("refresh-complete");
      return outcome;
    });

    const done = finalizeBootstrapSession({
      connector: { id: "test-connector" },
      commitReady: () => {
        events.push("commit-ready");
        commitReady();
      },
      refreshPolicies,
      markMilestone: vi.fn(),
      logError: vi.fn(),
      isStillActive: () => true,
    });

    await Promise.resolve();

    expect(commitReady).toHaveBeenCalledTimes(1);
    expect(events).toEqual(["commit-ready", "refresh-start"]);

    releaseRefresh();
    await done;

    expect(events).toEqual(["commit-ready", "refresh-start", "refresh-complete"]);
  });

  it("skips the policy refresh and records the skipped milestone when there is no connector", async () => {
    const commitReady = vi.fn();
    const markMilestone = vi.fn();
    const refreshPolicies = vi.fn();

    await finalizeBootstrapSession({
      connector: null,
      commitReady,
      refreshPolicies,
      markMilestone,
      logError: vi.fn(),
      isStillActive: () => true,
    });

    expect(commitReady).toHaveBeenCalledTimes(1);
    expect(refreshPolicies).not.toHaveBeenCalled();
    expect(markMilestone).toHaveBeenCalledWith("session-policies-refresh-skipped");
  });

  it("logs refresh failures without swallowing the ready commit", async () => {
    const commitReady = vi.fn();
    const logError = vi.fn();
    const refreshPolicies = vi.fn(() => Promise.reject(new Error("keychain down")));

    await finalizeBootstrapSession({
      connector: { id: "test-connector" },
      commitReady,
      refreshPolicies,
      markMilestone: vi.fn(),
      logError,
      isStillActive: () => true,
    });

    expect(commitReady).toHaveBeenCalledTimes(1);
    expect(logError).toHaveBeenCalledTimes(1);
    expect(logError.mock.calls[0][0]).toBeInstanceOf(Error);
  });

  it("bails out before commitReady when the run has been superseded", async () => {
    const commitReady = vi.fn();
    const refreshPolicies = vi.fn();

    await finalizeBootstrapSession({
      connector: { id: "test-connector" },
      commitReady,
      refreshPolicies,
      markMilestone: vi.fn(),
      logError: vi.fn(),
      isStillActive: () => false,
    });

    expect(commitReady).not.toHaveBeenCalled();
    expect(refreshPolicies).not.toHaveBeenCalled();
  });

  it("skips the refresh-completed milestone when the run is superseded mid-refresh", async () => {
    const markMilestone = vi.fn();
    let isActive = true;
    const refreshPolicies = vi.fn(() => {
      isActive = false;
      return Promise.resolve(true);
    });

    await finalizeBootstrapSession({
      connector: { id: "test-connector" },
      commitReady: vi.fn(),
      refreshPolicies,
      markMilestone,
      logError: vi.fn(),
      isStillActive: () => isActive,
    });

    expect(markMilestone).toHaveBeenCalledWith("session-policies-refresh-started");
    expect(markMilestone).not.toHaveBeenCalledWith("session-policies-refresh-completed");
  });
});
