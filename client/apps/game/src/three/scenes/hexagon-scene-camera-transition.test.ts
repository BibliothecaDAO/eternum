import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  createCameraTransitionState,
  publishCameraTransitionFrame,
  resolveCameraTransitionCompletion,
  resolveCameraTransitionStart,
} from "./hexagon-scene-camera-transition";

function readHexagonSceneSource(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, "hexagon-scene.ts"), "utf8");
}

describe("publishCameraTransitionFrame", () => {
  it("lets controls own change dispatch when update reports movement", () => {
    const calls: string[] = [];

    publishCameraTransitionFrame({
      updateControls: () => {
        calls.push("update");
        return true;
      },
      syncDistanceVisuals: () => {
        calls.push("visuals");
      },
      emitFallbackChange: () => {
        calls.push("dispatch");
      },
      markVisibilityDirty: () => {
        calls.push("dirty");
      },
    });

    expect(calls).toEqual(["update", "visuals", "dirty"]);
  });

  it("falls back to a single manual change dispatch when controls do not emit", () => {
    const calls: string[] = [];

    publishCameraTransitionFrame({
      updateControls: () => {
        calls.push("update");
        return false;
      },
      syncDistanceVisuals: () => {
        calls.push("visuals");
      },
      emitFallbackChange: () => {
        calls.push("dispatch");
      },
      markVisibilityDirty: () => {
        calls.push("dirty");
      },
    });

    expect(calls).toEqual(["update", "visuals", "dispatch", "dirty"]);
  });
});

describe("camera transition state", () => {
  it("starts a transition without cancellation when no scripted zoom is active", () => {
    const result = resolveCameraTransitionStart(createCameraTransitionState());

    expect(result.nextState).toEqual({
      activeToken: 1,
      nextToken: 1,
    });
    expect(result.cancelledToken).toBeNull();
  });

  it("retargets by cancelling the active scripted zoom and issuing a new token", () => {
    const activeState = {
      activeToken: 2,
      nextToken: 2,
    };

    const result = resolveCameraTransitionStart(activeState);

    expect(result.cancelledToken).toBe(2);
    expect(result.nextState).toEqual({
      activeToken: 3,
      nextToken: 3,
    });
  });

  it("ignores stale completions after a retarget", () => {
    const activeState = {
      activeToken: 4,
      nextToken: 4,
    };

    expect(resolveCameraTransitionCompletion(activeState, 3)).toEqual({
      activeToken: 4,
      nextToken: 4,
    });
    expect(resolveCameraTransitionCompletion(activeState, 4)).toEqual({
      activeToken: null,
      nextToken: 4,
    });
  });
});

describe("hexagon scene camera transition wiring", () => {
  it("uses the camera transition frame publisher and records retarget cancellations", () => {
    const source = readHexagonSceneSource();

    expect(source).toMatch(/publishCameraTransitionFrame\(/);
    expect(source).toMatch(/incrementWorldmapRenderCounter\("zoomTransitionsCancelled"\)/);
    expect(source).toMatch(/gsap\.timeline\(\{/);
  });
});
