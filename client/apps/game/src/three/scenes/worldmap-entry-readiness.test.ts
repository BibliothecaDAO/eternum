import { describe, expect, it, vi } from "vitest";

import { createControlledAsyncCall, flushMicrotasks } from "./worldmap-test-harness";
import { completeWorldmapEntryReadiness } from "./worldmap-entry-readiness";

describe("completeWorldmapEntryReadiness", () => {
  it("publishes critical readiness once while ambient convergence remains open", async () => {
    const criticalPass = createControlledAsyncCall<[], void>();
    const ambientConvergence = createControlledAsyncCall<[], void>();
    const markCriticalPassReady = vi.fn();
    const markWorldmapConverged = vi.fn();

    const completion = completeWorldmapEntryReadiness({
      bootToken: 7,
      commitCriticalPass: criticalPass.fn,
      isCurrentBootToken: (bootToken) => bootToken === 7,
      markCriticalPassReady,
      markWorldmapConverged,
      phase: "initial",
      waitForAmbientConvergence: ambientConvergence.fn,
    });

    criticalPass.resolveNext();
    await flushMicrotasks(2);

    expect(markCriticalPassReady).toHaveBeenCalledOnce();
    expect(markCriticalPassReady).toHaveBeenCalledWith(7);
    expect(markWorldmapConverged).not.toHaveBeenCalled();
    expect(ambientConvergence.pendingCount()).toBe(1);

    ambientConvergence.resolveNext();
    await completion;

    expect(markCriticalPassReady).toHaveBeenCalledOnce();
    expect(markWorldmapConverged).toHaveBeenCalledOnce();
    expect(markWorldmapConverged).toHaveBeenCalledWith(7);
  });

  it("continues ambient convergence without publishing a superseded critical pass", async () => {
    const criticalPass = createControlledAsyncCall<[], void>();
    const ambientConvergence = createControlledAsyncCall<[], void>();
    const markCriticalPassReady = vi.fn();
    const markWorldmapConverged = vi.fn();
    let currentBootToken = 11;

    const completion = completeWorldmapEntryReadiness({
      bootToken: 11,
      commitCriticalPass: criticalPass.fn,
      isCurrentBootToken: (bootToken) => bootToken === currentBootToken,
      markCriticalPassReady,
      markWorldmapConverged,
      phase: "initial",
      waitForAmbientConvergence: ambientConvergence.fn,
    });

    currentBootToken = 12;
    criticalPass.resolveNext();
    await flushMicrotasks(2);

    expect(markCriticalPassReady).not.toHaveBeenCalled();
    expect(ambientConvergence.pendingCount()).toBe(1);

    ambientConvergence.resolveNext();
    await completion;

    expect(markWorldmapConverged).not.toHaveBeenCalled();
  });

  it("does not publish convergence when the boot is superseded after critical readiness", async () => {
    const criticalPass = createControlledAsyncCall<[], void>();
    const ambientConvergence = createControlledAsyncCall<[], void>();
    const markCriticalPassReady = vi.fn();
    const markWorldmapConverged = vi.fn();
    let currentBootToken = 15;

    const completion = completeWorldmapEntryReadiness({
      bootToken: 15,
      commitCriticalPass: criticalPass.fn,
      isCurrentBootToken: (bootToken) => bootToken === currentBootToken,
      markCriticalPassReady,
      markWorldmapConverged,
      phase: "initial",
      waitForAmbientConvergence: ambientConvergence.fn,
    });

    criticalPass.resolveNext();
    await flushMicrotasks(2);
    expect(markCriticalPassReady).toHaveBeenCalledOnce();

    currentBootToken = 16;
    ambientConvergence.resolveNext();
    await completion;

    expect(markCriticalPassReady).toHaveBeenCalledOnce();
    expect(markWorldmapConverged).not.toHaveBeenCalled();
  });

  it("publishes resume convergence with the winning critical pass", async () => {
    const waitForAmbientConvergence = vi.fn();
    const markCriticalPassReady = vi.fn();
    const markWorldmapConverged = vi.fn();

    await completeWorldmapEntryReadiness({
      bootToken: 19,
      commitCriticalPass: async () => {},
      isCurrentBootToken: () => true,
      markCriticalPassReady,
      markWorldmapConverged,
      phase: "resume",
      waitForAmbientConvergence,
    });

    expect(waitForAmbientConvergence).not.toHaveBeenCalled();
    expect(markCriticalPassReady).toHaveBeenCalledWith(19);
    expect(markWorldmapConverged).toHaveBeenCalledWith(19);
  });
});
