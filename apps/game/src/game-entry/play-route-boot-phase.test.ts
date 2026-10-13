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
      readiness.markSceneFailed(token, "hex", new Error("The realm view did not open."));
    });
    expect(failed).toBe("error");
    expect(phaseAt("hex", (token) => usePlayRouteReadinessStore.getState().markWorldmapReady(token))).toBe(
      "handoff_scene",
    );
  });

  it("ends the wait for the world map the same way", () => {
    expect(
      phaseAt(null, (token) => usePlayRouteReadinessStore.getState().markSceneFailed(token, "map", new Error("x"))),
    ).toBe("error");
  });

  it("goes on to the realm view alone when the player opens it after the map could not be drawn", () => {
    const mapFailed = (token: number) =>
      usePlayRouteReadinessStore.getState().markSceneFailed(token, "map", new Error("The world map did not open."));
    // The boot was on the map itself (a reload there): no hand-off was asked for, and the realm still opens.
    for (const resumeScene of ["hex", null] as const) {
      const opening = phaseAt(resumeScene, (token) => {
        mapFailed(token);
        usePlayRouteReadinessStore.getState().openRealmWithoutMap(token);
      });
      expect(opening).toBe("handoff_scene");
      const opened = phaseAt(resumeScene, (token) => {
        mapFailed(token);
        usePlayRouteReadinessStore.getState().openRealmWithoutMap(token);
        usePlayRouteReadinessStore.getState().markHexReady(token);
      });
      expect(opened).toBe("ready");
    }
    // The realm view failing too ends there: nothing is left to open.
    const both = phaseAt("hex", (token) => {
      mapFailed(token);
      usePlayRouteReadinessStore.getState().openRealmWithoutMap(token);
      usePlayRouteReadinessStore.getState().markSceneFailed(token, "hex", new Error("The realm view did not open."));
    });
    expect(both).toBe("error");
  });

  it("leaves a game that finished booting as it is, and ignores a failure from an earlier boot", () => {
    const later = phaseAt("hex", (token) => {
      const readiness = usePlayRouteReadinessStore.getState();
      readiness.markWorldmapReady(token);
      readiness.markHexReady(token);
      readiness.markSceneFailed(token, "map", new Error("The world map did not open."));
    });
    expect(later).toBe("ready");
    const stale = phaseAt("hex", (token) => {
      const readiness = usePlayRouteReadinessStore.getState();
      readiness.markWorldmapReady(token);
      readiness.markSceneFailed(token - 1, "hex", new Error("The realm view did not open."));
    });
    expect(stale).toBe("handoff_scene");
  });
});
