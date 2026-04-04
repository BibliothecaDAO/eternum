import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  WORLD_NAVIGATION_PAN_TO_HEX_EVENT,
  WORLD_NAVIGATION_ZOOM_DELTA_EVENT,
  requestWorldNavigationPanToHex,
  requestWorldNavigationZoomDelta,
} from "./world-navigation-bridge";

describe("world-navigation-bridge", () => {
  beforeEach(() => {
    const eventTarget = new EventTarget();
    vi.stubGlobal("window", {
      addEventListener: eventTarget.addEventListener.bind(eventTarget),
      removeEventListener: eventTarget.removeEventListener.bind(eventTarget),
      dispatchEvent: eventTarget.dispatchEvent.bind(eventTarget),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("dispatches pan-to-hex events with contract hex coordinates", () => {
    const listener = vi.fn();
    window.addEventListener(WORLD_NAVIGATION_PAN_TO_HEX_EVENT, listener as EventListener, { once: true });

    requestWorldNavigationPanToHex({ col: 11, row: 19 });

    expect(listener).toHaveBeenCalledTimes(1);
    const event = listener.mock.calls[0][0] as CustomEvent<{ hex: { col: number; row: number } }>;
    expect(event.detail.hex).toEqual({ col: 11, row: 19 });
  });

  it("dispatches zoom-delta events with the requested source", () => {
    const listener = vi.fn();
    window.addEventListener(WORLD_NAVIGATION_ZOOM_DELTA_EVENT, listener as EventListener, { once: true });

    requestWorldNavigationZoomDelta(-120, "strategic_map");

    expect(listener).toHaveBeenCalledTimes(1);
    const event = listener.mock.calls[0][0] as CustomEvent<{ delta: number; source: string }>;
    expect(event.detail).toEqual({
      delta: -120,
      source: "strategic_map",
    });
  });
});
