import { Vector3 } from "three";
import { describe, expect, it, vi } from "vitest";

import { applyProceduralDragonConfigPatch, createDefaultProceduralDragonConfig } from "./procedural-dragon-config";
import { createIcyDragonTestLibrary } from "./icy-dragon-test-fixture";
import { ICY_DRAGON_RIG_ADAPTER } from "./icy-dragon-rig-adapter";
import { ProceduralDragonRuntime, type ProceduralDragonActor } from "./procedural-dragon-runtime";

describe("procedural dragon runtime", () => {
  it("flies, breathes fire, reacts, drops, resets, and disposes through one lifecycle", async () => {
    const runtime = await ProceduralDragonRuntime.create(createIcyDragonTestLibrary());
    const actor = runtime.createActor(createDefaultProceduralDragonConfig());
    const onRelease = vi.fn();
    actor.onFireRelease(onRelease);

    expect(actor.fireAt(new Vector3(0, 2, 6))).toBe(true);
    for (let frame = 0; frame < 180; frame += 1) actor.stepOnce();
    expect(onRelease).toHaveBeenCalledTimes(1);
    expect(actor.getStats().releaseCount).toBe(1);
    expect(actor.getStats()).toMatchObject({
      assetId: "icy-dragon-gltf",
      authoredClipCount: 0,
      rigAdapterId: "icy-dragon-gltf-v1",
    });
    expect(actor.getPoseDiagnostics().issues).toEqual([]);
    expect(actor.hasFiniteState()).toBe(true);

    actor.applyReaction({ directionX: 1, directionY: 0, directionZ: 0, source: "body-contact", strength: 0.2 });
    await actor.startRagdoll();
    actor.update(0.5);
    expect(actor.mode).toBe("ragdoll");

    actor.reset();
    expect(actor.mode).toBe("animated");
    expect(actor.hasFiniteState()).toBe(true);
    actor.dispose();
    expect(actor.object.parent).toBeNull();
    runtime.dispose();
  });

  it("drives Icy Dragon wing, leg, and neck bones from procedural phase instead of clips", async () => {
    const runtime = await ProceduralDragonRuntime.create(createIcyDragonTestLibrary());
    const config = createDefaultProceduralDragonConfig();
    const actor = runtime.createActor(config);
    const wing = actor.object.getObjectByName(ICY_DRAGON_RIG_ADAPTER.wings.left.root);
    const hip = actor.object.getObjectByName(ICY_DRAGON_RIG_ADAPTER.legs.frontLeft.hip);
    const neck = actor.object.getObjectByName(ICY_DRAGON_RIG_ADAPTER.neck[0]);
    expect(wing && hip && neck).toBeTruthy();

    const flightWing = wing!.quaternion.toArray();
    for (let frame = 0; frame < 12; frame += 1) actor.stepOnce();
    expect(wing!.quaternion.toArray()).not.toEqual(flightWing);

    actor.updateConfig(applyProceduralDragonConfigPatch(config, { locomotionMode: "walk", speed: 2 }));
    const walkHip = hip!.quaternion.toArray();
    for (let frame = 0; frame < 12; frame += 1) actor.stepOnce();
    expect(hip!.quaternion.toArray()).not.toEqual(walkHip);

    actor.updateConfig(applyProceduralDragonConfigPatch(config, { locomotionMode: "idle" }));
    const idleNeck = neck!.quaternion.toArray();
    for (let frame = 0; frame < 12; frame += 1) actor.stepOnce();
    expect(neck!.quaternion.toArray()).not.toEqual(idleNeck);
    expect(actor.getStats().authoredClipCount).toBe(0);

    actor.dispose();
    runtime.dispose();
  });

  it("keeps the lowest stance foot on the sampled ground in idle and walk", async () => {
    const runtime = await ProceduralDragonRuntime.create(createIcyDragonTestLibrary());
    const baseConfig = createDefaultProceduralDragonConfig();
    const actor = runtime.createActor(applyProceduralDragonConfigPatch(baseConfig, { locomotionMode: "idle" }));

    expect(resolveLowestStanceFootHeight(actor)).toBeCloseTo(0, 4);

    actor.updateConfig(applyProceduralDragonConfigPatch(baseConfig, { locomotionMode: "walk", speed: 2 }));
    for (let frame = 0; frame < 12; frame += 1) actor.stepOnce();
    expect(resolveLowestStanceFootHeight(actor)).toBeCloseTo(0, 4);

    actor.dispose();
    runtime.dispose();
  });

  it("takes off and lands progressively when movement requests flight", async () => {
    const runtime = await ProceduralDragonRuntime.create(createIcyDragonTestLibrary());
    const baseConfig = createDefaultProceduralDragonConfig();
    const actor = runtime.createActor(applyProceduralDragonConfigPatch(baseConfig, { locomotionMode: "idle" }));
    const landedHeight = actor.getPose().bodyPosition[1];
    expect(actor.getPoseDiagnostics().flightState).toBe("landed");

    actor.updateConfig(applyProceduralDragonConfigPatch(baseConfig, { locomotionMode: "flight" }));
    expect(actor.getPose().bodyPosition[1]).toBeCloseTo(landedHeight, 4);
    expect(actor.getPoseDiagnostics().flightState).toBe("taking-off");
    expect(actor.getPoseDiagnostics().issues).toEqual([]);
    actor.update(0.3);
    expect(actor.getPose().bodyPosition[1]).toBeGreaterThan(landedHeight);
    expect(actor.getPose().bodyPosition[1]).toBeLessThan(baseConfig.altitude);
    for (let frame = 0; frame < 90; frame += 1) actor.stepOnce();
    expect(actor.getPose().bodyPosition[1]).toBeGreaterThan(2);
    expect(actor.getPose().contactCount).toBe(0);
    expect(actor.getPoseDiagnostics().flightState).toBe("flying");

    actor.updateConfig(applyProceduralDragonConfigPatch(baseConfig, { locomotionMode: "idle" }));
    expect(actor.getPoseDiagnostics().flightState).toBe("landing");
    actor.update(0.3);
    expect(actor.getPose().bodyPosition[1]).toBeGreaterThan(landedHeight);
    for (let frame = 0; frame < 90; frame += 1) actor.stepOnce();
    expect(actor.getPose().bodyPosition[1]).toBeCloseTo(landedHeight, 4);
    expect(actor.getPose().contactCount).toBe(4);
    expect(actor.getPoseDiagnostics().flightState).toBe("landed");

    actor.dispose();
    runtime.dispose();
  });
});

function resolveLowestStanceFootHeight(actor: ProceduralDragonActor): number {
  const pose = actor.getPose();
  return Math.min(
    ...Object.entries(ICY_DRAGON_RIG_ADAPTER.legs)
      .filter(([legId]) => pose.legs[legId as keyof typeof pose.legs].contact)
      .map(([, { foot }]) => {
        const bone = actor.object.getObjectByName(foot);
        if (!bone) throw new Error(`Missing test foot bone ${foot}`);
        return bone.getWorldPosition(bone.position.clone()).y;
      }),
  );
}
