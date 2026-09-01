import { PerspectiveCamera, Scene, Vector3 } from "three";
import { describe, expect, it } from "vitest";

import { createWorldFxRuntime } from "./world-fx-runtime";

describe("WorldFxRuntime", () => {
  it("syncs persistent flame emitters and expires absent emitters", () => {
    const scene = new Scene();
    const runtime = createWorldFxRuntime({ camera: new PerspectiveCamera(), scene });

    runtime.sync([{ id: "forge:1", kind: "flame", position: new Vector3(1, 0, 2), scale: 1.2, seed: 7 }]);
    runtime.update(1 / 60);

    expect(runtime.getStats()).toMatchObject({ activeEmitters: 1 });
    expect(runtime.getStats().activeAdditiveParticles).toBeGreaterThan(0);
    expect(runtime.getStats().activeSmokeParticles).toBeGreaterThan(0);

    runtime.sync([]);
    expect(runtime.getStats().activeEmitters).toBe(0);
    runtime.dispose();
  });

  it("makes an impact burst visible atomically and settles its handle", async () => {
    const scene = new Scene();
    const runtime = createWorldFxRuntime({ camera: new PerspectiveCamera(), scene });
    const handle = runtime.emit({
      kind: "impact",
      normal: new Vector3(0, 1, 0),
      position: new Vector3(0, 0, 0),
      seed: 91,
    });

    expect(runtime.getStats()).toMatchObject({ activeAdditiveParticles: 19, activeRings: 1, activeSmokeParticles: 5 });

    for (let index = 0; index < 100; index += 1) runtime.update(1 / 60);
    await handle.promise;
    expect(runtime.getStats()).toMatchObject({ activeAdditiveParticles: 0, activeRings: 0, activeSmokeParticles: 0 });
    runtime.dispose();
  });

  it("produces the same fingerprint for the same seed and timeline", () => {
    const first = createWorldFxRuntime({ camera: new PerspectiveCamera(), scene: new Scene() });
    const second = createWorldFxRuntime({ camera: new PerspectiveCamera(), scene: new Scene() });
    const emitter = { id: "flame", kind: "flame" as const, position: new Vector3(0, 0, 0), seed: 123 };

    first.sync([emitter]);
    second.sync([emitter]);
    for (const delta of [1 / 60, 1 / 30, 1 / 60, 0.05]) {
      first.update(delta);
      second.update(delta);
    }

    expect(first.getStats().fingerprint).toBe(second.getStats().fingerprint);
    first.dispose();
    second.dispose();
  });

  it("rejects invalid inputs and disposes owned scene state idempotently", () => {
    const scene = new Scene();
    const runtime = createWorldFxRuntime({ camera: new PerspectiveCamera(), scene });

    expect(() => runtime.emit({ kind: "impact", position: new Vector3(Number.NaN, 0, 0), seed: 1 })).toThrow(
      "finite coordinates",
    );
    expect(scene.getObjectByName("world-fx-runtime")).toBeDefined();

    runtime.dispose();
    runtime.dispose();
    expect(scene.getObjectByName("world-fx-runtime")).toBeUndefined();
  });
});
