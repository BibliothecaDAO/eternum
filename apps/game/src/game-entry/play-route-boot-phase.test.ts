import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/context/identity-session", () => ({ useIdentitySession: () => ({ status: "anonymous" }) }));

import { resolveBootPhase } from "./play-route-boot";
import { usePlayRouteReadinessStore } from "./play-route-readiness-store";

const phaseAt = (resumeScene: "hex" | null, prepare: (token: number) => void) => {
  const readiness = usePlayRouteReadinessStore.getState();
  readiness.reset(1);
  prepare(1);
  return resolveBootPhase({
    bootstrapError: null,
    bootstrapStatus: "ready",
    hasResolvedAccount: true,
    isReconnectRequired: false,
    isSpectator: false,
    readiness: usePlayRouteReadinessStore.getState(),
    resolvedRequest: { entryMode: "player", resumeScene } as never,
  });
};

describe("a scene the entry waits on that does not set up", () => {
  it("ends the handoff to the realm view in the error state instead of waiting on", () => {
    const failed = phaseAt("hex", (token) => {
      const readiness = usePlayRouteReadinessStore.getState();
      readiness.markWorldmapReady(token);
      readiness.markSceneFailed(token, new Error("The realm view did not open."));
    });
    expect(failed).toBe("error");
    expect(phaseAt("hex", (token) => usePlayRouteReadinessStore.getState().markWorldmapReady(token))).toBe(
      "handoff_scene",
    );
  });

  it("ends the wait for the world map the same way", () => {
    expect(phaseAt(null, (token) => usePlayRouteReadinessStore.getState().markSceneFailed(token, new Error("x")))).toBe(
      "error",
    );
  });

  it("leaves a game that finished booting as it is, and ignores a failure from an earlier boot", () => {
    const later = phaseAt("hex", (token) => {
      const readiness = usePlayRouteReadinessStore.getState();
      readiness.markWorldmapReady(token);
      readiness.markHexReady(token);
      readiness.markSceneFailed(token, new Error("The world map did not open."));
    });
    expect(later).toBe("ready");
    const stale = phaseAt("hex", (token) => {
      const readiness = usePlayRouteReadinessStore.getState();
      readiness.markWorldmapReady(token);
      readiness.markSceneFailed(token - 1, new Error("The realm view did not open."));
    });
    expect(stale).toBe("handoff_scene");
  });
});
