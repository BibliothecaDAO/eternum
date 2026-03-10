import { describe, expect, it, vi } from "vitest";
import { Box3, Scene, Sphere, Texture, Vector3 } from "three";
import { PointsLabelRenderer } from "./points-label-renderer";

describe("PointsLabelRenderer", () => {
  it("skips bounding sphere recomputation when fixed world bounds are applied", () => {
    const renderer = new PointsLabelRenderer(
      new Scene(),
      new Texture(),
      8,
      16,
      1,
      1.2,
      true,
      {
        onChange: () => () => {},
        isSphereVisible: vi.fn(() => true),
      } as any,
    );
    const bounds = {
      box: new Box3(new Vector3(-4, -1, -4), new Vector3(4, 1, 4)),
      sphere: new Sphere(new Vector3(0, 0, 0), 6),
    };
    const geometry = (renderer as any).geometry;
    const computeBoundingSphere = vi.spyOn(geometry, "computeBoundingSphere");

    renderer.setWorldBounds(bounds);
    renderer.beginBatch();
    renderer.setPoint({
      entityId: 1,
      position: new Vector3(1, 2, 3),
    });
    renderer.endBatch();

    expect(computeBoundingSphere).not.toHaveBeenCalled();
    expect(geometry.boundingSphere?.radius).toBe(bounds.sphere.radius);
    expect(geometry.boundingBox?.min.equals(bounds.box.min)).toBe(true);
    expect(geometry.boundingBox?.max.equals(bounds.box.max)).toBe(true);
  });
});
