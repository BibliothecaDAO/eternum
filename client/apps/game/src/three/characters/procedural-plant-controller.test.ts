import { Group, Vector3 } from "three";
import { describe, expect, it } from "vitest";

import { ProceduralPlantController } from "./procedural-plant-controller";

describe("procedural plant controller", () => {
  it("keeps a stance target fixed in world space while the actor root moves", () => {
    const root = new Group();
    const controller = new ProceduralPlantController<"left">();
    const stance = { contact: "stance" as const, progress: 0.5 };

    controller.beginFrame(root);
    controller.resolveTarget("left", stance, [0, 0, 0], 1);
    root.position.set(1, 0, 0);
    controller.beginFrame(root);
    const localTarget = controller.resolveTarget("left", stance, [0, 0, 0], 1);
    const worldTarget = root.localToWorld(new Vector3(...localTarget));

    expect(worldTarget.toArray()).toEqual([0, 0, 0]);
  });

  it("rebases staged contacts when an actor is placed at zero simulation time", () => {
    const root = new Group();
    const controller = new ProceduralPlantController<"left">();
    const stance = { contact: "stance" as const, progress: 0.5 };

    controller.beginFrame(root);
    controller.resolveTarget("left", stance, [0, 0, 0.2], 1);
    root.position.set(24, 0, -18);
    controller.beginFrame(root, 0);
    const localTarget = controller.resolveTarget("left", stance, [0, 0, 0.2], 1);
    const worldTarget = root.localToWorld(new Vector3(...localTarget));

    expect(localTarget).toEqual([0, 0, 0.2]);
    expect(worldTarget.toArray()).toEqual([24, 0, -17.8]);
    expect(controller.getFrameTravelDistance()).toBe(0);
  });

  it("leaves in-place preview trajectories unlocked and releases plants during swing", () => {
    const root = new Group();
    const controller = new ProceduralPlantController<"left">();

    controller.beginFrame(root);
    expect(controller.resolveTarget("left", { contact: "stance", progress: 0.5 }, [0, 0, 0.2], 1)).toEqual([0, 0, 0.2]);
    expect(controller.resolveTarget("left", { contact: "swing", progress: 0.2 }, [0, 0.3, -0.1], 1)).toEqual([
      0, 0.3, -0.1,
    ]);
  });

  it("eases a moving root away from its plant during early swing", () => {
    const root = new Group();
    const controller = new ProceduralPlantController<"left">();

    controller.beginFrame(root);
    controller.resolveTarget("left", { contact: "stance", progress: 0.5 }, [0, 0, 0], 1);
    root.position.x = 1;
    controller.beginFrame(root);
    controller.resolveTarget("left", { contact: "stance", progress: 0.95 }, [0, 0, 0], 1);
    root.position.x = 1.1;
    controller.beginFrame(root);
    const toeOffTarget = controller.resolveTarget("left", { contact: "swing", progress: 0 }, [0, 0.2, 0], 1);
    const toeOffWorld = root.localToWorld(new Vector3(...toeOffTarget));
    const releasedTarget = controller.resolveTarget("left", { contact: "swing", progress: 0.12 }, [0, 0.2, 0], 1);
    const releasedWorld = root.localToWorld(new Vector3(...releasedTarget));

    expect(toeOffWorld.toArray()).toEqual([0, 0, 0]);
    expect(releasedWorld.toArray()).toEqual([1.1, 0.2, 0]);
  });

  it("does not introduce a swing anchor when planting is disabled", () => {
    const root = new Group();
    const controller = new ProceduralPlantController<"left">();

    controller.beginFrame(root);
    controller.resolveTarget("left", { contact: "stance", progress: 0.5 }, [0, 0, 0], 0);
    root.position.x = 1;
    controller.beginFrame(root);
    controller.resolveTarget("left", { contact: "stance", progress: 0.95 }, [0, 0, 0], 0);
    const target = controller.resolveTarget("left", { contact: "swing", progress: 0 }, [0, 0.2, 0], 0);

    expect(target).toEqual([0, 0.2, 0]);
  });
});
