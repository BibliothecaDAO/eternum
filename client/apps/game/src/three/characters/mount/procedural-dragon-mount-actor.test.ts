import { Vector3 } from "three";
import { describe, expect, it, vi } from "vitest";

import { applyProceduralUnitConfigPatch, createDefaultProceduralUnitConfig } from "../procedural-unit-config";
import { createIcyDragonTestLibrary } from "../dragon/icy-dragon-test-fixture";
import { ProceduralDragonRuntime } from "../dragon/procedural-dragon-runtime";
import { ProceduralDragonMountActor } from "./procedural-dragon-mount-actor";

describe("procedural dragon mount actor", () => {
  it("exposes flight, saddle, mouth, fire, terrain, and lifecycle through the mount seam", async () => {
    const runtime = await ProceduralDragonRuntime.create(createIcyDragonTestLibrary());
    const config = applyProceduralUnitConfigPatch(createDefaultProceduralUnitConfig(), { kind: "dragon" });
    const mount = new ProceduralDragonMountActor(runtime.createActor(config.dragon));
    const release = vi.fn();
    mount.onFireRelease(release);

    expect(mount.kind).toBe("dragon");
    expect(mount.getPose().actionOriginPosition).toHaveLength(3);
    expect(mount.getPose().saddlePosition).toHaveLength(3);
    expect(mount.getPoseDiagnostics().dragon.issues).toEqual([]);
    expect(mount.fireAt(new Vector3(0, 2, 6))).toBe(true);
    for (let frame = 0; frame < 120; frame += 1) mount.stepOnce();
    expect(release).toHaveBeenCalledTimes(1);

    mount.updateConfig(
      applyProceduralUnitConfigPatch(config, { dragon: { locomotionMode: "walk", renderDetail: "crowd" } }),
    );
    mount.setTerrainSampler(() => ({ height: 0.4, normal: [0, 1, 0] }));
    expect(mount.getPoseDiagnostics().dragon.contactCount).toBeGreaterThan(0);
    await mount.startRagdoll();
    expect(mount.mode).toBe("ragdoll");
    mount.reset();
    expect(mount.mode).toBe("animated");
    mount.dispose();
    runtime.dispose();
  });
});
