import { describe, expect, it, vi } from "vitest";

import { createControlledAsyncCall, flushMicrotasks } from "./worldmap-test-harness";
import { startWorldmapEntryReadiness } from "./worldmap-entry-readiness";

describe("startWorldmapEntryReadiness", () => {
  it("resolves setup after critical readiness while ambient convergence remains open", async () => {
    const criticalPass = createControlledAsyncCall<[], void>();
    const ambientConvergence = createControlledAsyncCall<[], void>();
    const markCriticalPassReady = vi.fn();
    const markWorldmapConverged = vi.fn();
    const reportAmbientConvergenceError = vi.fn();

    const setup = startWorldmapEntryReadiness({
      bootToken: 7,
      commitCriticalPass: criticalPass.fn,
      isCurrent: () => true,
      markCriticalPassReady,
      markWorldmapConverged,
      requiresAmbientConvergence: true,
      reportAmbientConvergenceError,
      waitForAmbientConvergence: ambientConvergence.fn,
    });

    criticalPass.resolveNext();
    await setup;

    expect(markCriticalPassReady).toHaveBeenCalledOnce();
    expect(markCriticalPassReady).toHaveBeenCalledWith(7);
    expect(markWorldmapConverged).not.toHaveBeenCalled();
    expect(ambientConvergence.pendingCount()).toBe(1);

    ambientConvergence.resolveNext();
    await flushMicrotasks(2);

    expect(markCriticalPassReady).toHaveBeenCalledOnce();
    expect(markWorldmapConverged).toHaveBeenCalledOnce();
    expect(markWorldmapConverged).toHaveBeenCalledWith(7);
    expect(reportAmbientConvergenceError).not.toHaveBeenCalled();
  });

  it("does not start ambient convergence for a superseded critical pass", async () => {
    const criticalPass = createControlledAsyncCall<[], void>();
    const ambientConvergence = createControlledAsyncCall<[], void>();
    const markCriticalPassReady = vi.fn();
    const markWorldmapConverged = vi.fn();
    let isCurrent = true;

    const setup = startWorldmapEntryReadiness({
      bootToken: 11,
      commitCriticalPass: criticalPass.fn,
      isCurrent: () => isCurrent,
      markCriticalPassReady,
      markWorldmapConverged,
      requiresAmbientConvergence: true,
      reportAmbientConvergenceError: vi.fn(),
      waitForAmbientConvergence: ambientConvergence.fn,
    });

    isCurrent = false;
    criticalPass.resolveNext();
    await setup;

    expect(markCriticalPassReady).not.toHaveBeenCalled();
    expect(ambientConvergence.pendingCount()).toBe(0);
    expect(markWorldmapConverged).not.toHaveBeenCalled();
  });

  it("does not publish convergence when scene ownership is superseded after critical readiness", async () => {
    const criticalPass = createControlledAsyncCall<[], void>();
    const ambientConvergence = createControlledAsyncCall<[], void>();
    const markCriticalPassReady = vi.fn();
    const markWorldmapConverged = vi.fn();
    let isCurrent = true;

    const setup = startWorldmapEntryReadiness({
      bootToken: 15,
      commitCriticalPass: criticalPass.fn,
      isCurrent: () => isCurrent,
      markCriticalPassReady,
      markWorldmapConverged,
      requiresAmbientConvergence: true,
      reportAmbientConvergenceError: vi.fn(),
      waitForAmbientConvergence: ambientConvergence.fn,
    });

    criticalPass.resolveNext();
    await setup;
    expect(markCriticalPassReady).toHaveBeenCalledOnce();

    isCurrent = false;
    ambientConvergence.resolveNext();
    await flushMicrotasks(2);

    expect(markCriticalPassReady).toHaveBeenCalledOnce();
    expect(markWorldmapConverged).not.toHaveBeenCalled();
  });

  it("requires the resumed setup to finish ambient convergence after the initial owner is superseded", async () => {
    const firstAmbientConvergence = createControlledAsyncCall<[], void>();
    const resumedAmbientConvergence = createControlledAsyncCall<[], void>();
    const markWorldmapConverged = vi.fn();
    let firstOwnerIsCurrent = true;

    await startWorldmapEntryReadiness({
      bootToken: 16,
      commitCriticalPass: async () => {},
      isCurrent: () => firstOwnerIsCurrent,
      markCriticalPassReady: vi.fn(),
      markWorldmapConverged,
      requiresAmbientConvergence: true,
      reportAmbientConvergenceError: vi.fn(),
      waitForAmbientConvergence: firstAmbientConvergence.fn,
    });

    firstOwnerIsCurrent = false;
    await startWorldmapEntryReadiness({
      bootToken: 16,
      commitCriticalPass: async () => {},
      isCurrent: () => true,
      markCriticalPassReady: vi.fn(),
      markWorldmapConverged,
      requiresAmbientConvergence: true,
      reportAmbientConvergenceError: vi.fn(),
      waitForAmbientConvergence: resumedAmbientConvergence.fn,
    });

    expect(firstAmbientConvergence.pendingCount()).toBe(1);
    expect(resumedAmbientConvergence.pendingCount()).toBe(1);
    expect(markWorldmapConverged).not.toHaveBeenCalled();

    firstAmbientConvergence.resolveNext();
    await flushMicrotasks(2);
    expect(markWorldmapConverged).not.toHaveBeenCalled();

    resumedAmbientConvergence.resolveNext();
    await flushMicrotasks(2);
    expect(markWorldmapConverged).toHaveBeenCalledWith(16);
  });

  it("reports an owned ambient convergence failure without rejecting setup", async () => {
    const ambientError = new Error("ambient failed");
    const reportAmbientConvergenceError = vi.fn();

    await startWorldmapEntryReadiness({
      bootToken: 17,
      commitCriticalPass: async () => {},
      isCurrent: () => true,
      markCriticalPassReady: vi.fn(),
      markWorldmapConverged: vi.fn(),
      requiresAmbientConvergence: true,
      reportAmbientConvergenceError,
      waitForAmbientConvergence: async () => {
        throw ambientError;
      },
    });
    await flushMicrotasks(2);

    expect(reportAmbientConvergenceError).toHaveBeenCalledWith(ambientError);
  });

  it("does not report an ambient failure after setup ownership is superseded", async () => {
    const ambientConvergence = createControlledAsyncCall<[], void>();
    const reportAmbientConvergenceError = vi.fn();
    let isCurrent = true;

    await startWorldmapEntryReadiness({
      bootToken: 18,
      commitCriticalPass: async () => {},
      isCurrent: () => isCurrent,
      markCriticalPassReady: vi.fn(),
      markWorldmapConverged: vi.fn(),
      requiresAmbientConvergence: true,
      reportAmbientConvergenceError,
      waitForAmbientConvergence: ambientConvergence.fn,
    });

    isCurrent = false;
    ambientConvergence.rejectNext(new Error("stale ambient failure"));
    await flushMicrotasks(2);

    expect(reportAmbientConvergenceError).not.toHaveBeenCalled();
  });

  it("reports a detached convergence callback failure", async () => {
    const ambientConvergence = createControlledAsyncCall<[], void>();
    const callbackError = new Error("convergence callback failed");
    const reportAmbientConvergenceError = vi.fn();

    await startWorldmapEntryReadiness({
      bootToken: 19,
      commitCriticalPass: async () => {},
      isCurrent: () => true,
      markCriticalPassReady: vi.fn(),
      markWorldmapConverged: () => {
        throw callbackError;
      },
      requiresAmbientConvergence: true,
      reportAmbientConvergenceError,
      waitForAmbientConvergence: ambientConvergence.fn,
    });

    ambientConvergence.resolveNext();
    await flushMicrotasks(2);

    expect(reportAmbientConvergenceError).toHaveBeenCalledWith(callbackError);
  });

  it("publishes already-complete convergence without another ambient wait", async () => {
    const waitForAmbientConvergence = vi.fn();
    const markCriticalPassReady = vi.fn();
    const markWorldmapConverged = vi.fn();

    await startWorldmapEntryReadiness({
      bootToken: 20,
      commitCriticalPass: async () => {},
      isCurrent: () => true,
      markCriticalPassReady,
      markWorldmapConverged,
      requiresAmbientConvergence: false,
      reportAmbientConvergenceError: vi.fn(),
      waitForAmbientConvergence,
    });

    expect(waitForAmbientConvergence).not.toHaveBeenCalled();
    expect(markCriticalPassReady).toHaveBeenCalledWith(20);
    expect(markWorldmapConverged).toHaveBeenCalledWith(20);
  });
});
