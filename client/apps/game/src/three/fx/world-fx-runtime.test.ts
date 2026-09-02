import { PerspectiveCamera, Scene, Vector3 } from "three";
import { describe, expect, it } from "vitest";

import { createWorldFxRuntime } from "./world-fx-runtime";

describe("WorldFxRuntime", () => {
  it("syncs persistent flame emitters and expires absent emitters", () => {
    const scene = new Scene();
    const runtime = createWorldFxRuntime({ camera: new PerspectiveCamera(), scene });

    runtime.sync([{ id: "forge:1", kind: "flame", position: new Vector3(1, 0, 2), scale: 1.2, seed: 7 }]);
    runtime.update(1 / 60);

    expect(runtime.getStats()).toMatchObject({ activeEmitters: 1, activeFlameEmitters: 1 });
    expect(runtime.getStats().activeAdditiveParticles).toBeGreaterThan(0);
    expect(runtime.getStats().activeSmokeParticles).toBeGreaterThan(0);

    runtime.sync([]);
    expect(runtime.getStats().activeEmitters).toBe(0);
    runtime.dispose();
  });

  it("syncs procedural status auras through the persistent emitter path", () => {
    const runtime = createWorldFxRuntime({ camera: new PerspectiveCamera(), scene: new Scene() });
    runtime.sync([
      { id: "shield:1", kind: "aura", position: new Vector3(0, 0, 0), scale: 0.8, seed: 17, style: "shield" },
    ]);
    runtime.update(0.3);

    expect(runtime.getStats()).toMatchObject({ activeAuraEmitters: 1, activeEmitters: 1 });
    expect(runtime.getStats().activeAdditiveParticles).toBeGreaterThan(0);
    expect(runtime.getStats().activeRings).toBeGreaterThan(0);

    runtime.sync([]);
    expect(runtime.getStats()).toMatchObject({ activeAuraEmitters: 0, activeEmitters: 0 });
    runtime.dispose();
  });

  it.each([
    {
      cue: { kind: "explosion" as const, position: new Vector3(0, 0, 0), seed: 11 },
      kind: "explosion",
    },
    {
      cue: { kind: "shockwave" as const, position: new Vector3(0, 0, 0), seed: 12 },
      kind: "shockwave",
    },
    {
      cue: {
        from: new Vector3(-1, 0.2, 0),
        kind: "projectile-trail" as const,
        seed: 13,
        to: new Vector3(1, 0.6, 0),
      },
      kind: "projectile trail",
    },
    {
      cue: { from: new Vector3(-1, 0.2, 0), kind: "beam" as const, seed: 14, to: new Vector3(1, 0.6, 0) },
      kind: "beam",
    },
    {
      cue: {
        from: new Vector3(-1, 0.2, 0),
        kind: "dragon-breath" as const,
        seed: 15,
        to: new Vector3(1, 0.6, 0),
      },
      kind: "dragon breath",
    },
  ])("runs the $kind recipe atomically and settles its handle", async ({ cue }) => {
    const runtime = createWorldFxRuntime({ camera: new PerspectiveCamera(), scene: new Scene() });
    const handle = runtime.emit(cue);

    expect(runtime.getStats().activeTransientEffects).toBe(1);
    expect(
      runtime.getStats().activeAdditiveParticles +
        runtime.getStats().activeSmokeParticles +
        runtime.getStats().activeRings,
    ).toBeGreaterThan(0);

    for (let index = 0; index < 180; index += 1) runtime.update(1 / 60);
    await handle.promise;
    expect(runtime.getStats().activeTransientEffects).toBe(0);
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
