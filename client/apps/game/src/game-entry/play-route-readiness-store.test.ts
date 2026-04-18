// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { usePlayRouteReadinessStore } from "./play-route-readiness-store";

describe("usePlayRouteReadinessStore", () => {
  beforeEach(() => {
    usePlayRouteReadinessStore.setState({
      bootToken: 0,
      fastTravelReady: false,
      hexCoordinates: null,
      hexReady: false,
      worldmapReady: false,
    });
  });

  it("marks worldmap ready when the token matches the current boot", () => {
    usePlayRouteReadinessStore.getState().reset(5);
    usePlayRouteReadinessStore.getState().markWorldmapReady(5);

    expect(usePlayRouteReadinessStore.getState().worldmapReady).toBe(true);
  });

  it("logs a warning and leaves worldmapReady untouched when markWorldmapReady fires with a stale token", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    usePlayRouteReadinessStore.getState().reset(5);
    usePlayRouteReadinessStore.getState().markWorldmapReady(4);

    expect(usePlayRouteReadinessStore.getState().worldmapReady).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
    const [message] = warn.mock.calls[0];
    expect(String(message)).toContain("markWorldmapReady");
    expect(String(message)).toContain("4");
    expect(String(message)).toContain("5");

    warn.mockRestore();
  });
});
