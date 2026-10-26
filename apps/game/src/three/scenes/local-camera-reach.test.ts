import { describe, expect, it } from "vitest";

import { LOCAL_CAMERA_ZOOM } from "@/three/constants/rendering";
import { localCameraMaxDistance } from "./local-camera-reach";

const PHONE = 390 / 844;
const DESKTOP = 1920 / 1080;

/** How wide a strip of ground the camera sees across the screen at this distance, from its centre to one edge. */
const halfWidthSeen = (distance: number, aspect: number) => distance * Math.tan((45 * Math.PI) / 360) * aspect;

describe("the realm view's farthest zoom", () => {
  it("lets an upright phone pull back until a Kingdom's and an Empire's outermost plots fit inside the screen", () => {
    for (const plotRadius of [3, 4]) {
      const distance = localCameraMaxDistance({ plotRadius, aspect: PHONE, fovDegrees: 45 });
      // The outermost plot's far edge, (radius + ½) plots of √3 from the castle, with a tenth more beside it.
      expect(halfWidthSeen(distance, PHONE)).toBeCloseTo((plotRadius + 0.5) * Math.sqrt(3) * 1.1, 6);
    }
    expect(localCameraMaxDistance({ plotRadius: 3, aspect: PHONE, fovDegrees: 45 })).toBeCloseTo(34.84, 2);
    expect(localCameraMaxDistance({ plotRadius: 4, aspect: PHONE, fovDegrees: 45 })).toBeCloseTo(44.79, 2);
  });

  it("keeps the view's own limit where the board already fits, as on a desktop", () => {
    expect(localCameraMaxDistance({ plotRadius: 4, aspect: DESKTOP, fovDegrees: 45 })).toBe(
      LOCAL_CAMERA_ZOOM.maxDistance,
    );
    expect(localCameraMaxDistance({ plotRadius: 1, aspect: PHONE, fovDegrees: 45 })).toBe(
      LOCAL_CAMERA_ZOOM.maxDistance,
    );
  });
});
