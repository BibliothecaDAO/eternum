import { Box3, BufferGeometry, Float32BufferAttribute, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import {
  BEAST_MOTION_ACTIONS,
  BEAST_MOTION_CYCLE_SECONDS,
  BEAST_MOTION_HYBRID_BONE_COUNT,
  BEAST_MOTION_SPECIES_LIST,
  WYVERN_FULL_RIG_SPECS,
  applyBeastSpatialSkinning,
  buildFullBeastRigClips,
  computeHexFormationOffsets,
  createBeastHybridSkeleton,
  createFullBeastSkeleton,
  poseBeastHybridRig,
  sampleBeastMotionCycle,
} from "./beast-motion-model";

function sampleBeastGeometry(): { geometry: BufferGeometry; bounds: Box3 } {
  const geometry = new BufferGeometry();
  const points = [
    0, 0.42, 0.05, 0, 0.98, 0.18, 0, 1.12, 0.14, -0.44, 0.72, -0.02, 0.44, 0.72, -0.02, 0.26, 0.14, -0.34, -0.2, 0.05,
    0.06, 0.2, 0.05, 0.06,
  ];
  geometry.setAttribute("position", new Float32BufferAttribute(points, 3));
  geometry.computeBoundingBox();
  return {
    geometry,
    bounds: geometry.boundingBox ?? new Box3(new Vector3(-0.44, 0, -0.34), new Vector3(0.44, 1.12, 0.18)),
  };
}

describe("beast motion model", () => {
  it("moves at rest during idle and traverses a hex during walk", () => {
    const start = sampleBeastMotionCycle("idle", 0);
    const quarter = sampleBeastMotionCycle("idle", BEAST_MOTION_CYCLE_SECONDS * 0.25);
    expect(Math.abs(quarter.weightShift - start.weightShift)).toBeGreaterThan(0.5);
    expect(Math.abs(quarter.headYaw - start.headYaw)).toBeGreaterThan(0.1);
    expect(start.walkOffsetZ).toBe(0);

    const walkPeak = sampleBeastMotionCycle("walk", BEAST_MOTION_CYCLE_SECONDS * 0.25);
    const walkOpp = sampleBeastMotionCycle("walk", BEAST_MOTION_CYCLE_SECONDS * 0.75);
    expect(walkPeak.walkOffsetZ).toBeGreaterThan(0.5);
    expect(walkOpp.walkOffsetZ).toBeLessThan(-0.5);
  });

  it("plays attack lunge, hit flinch and death collapse within one cycle and settles cleanly", () => {
    const attackStart = sampleBeastMotionCycle("attack", 0);
    const attackPeak = sampleBeastMotionCycle("attack", BEAST_MOTION_CYCLE_SECONDS * 0.45);
    const attackEnd = sampleBeastMotionCycle("attack", BEAST_MOTION_CYCLE_SECONDS * 0.96);
    expect(attackStart.attackLunge).toBe(0);
    expect(attackPeak.attackLunge).toBeGreaterThan(0.8);
    expect(attackEnd.attackLunge).toBe(0);

    const hitPeak = sampleBeastMotionCycle("hit", BEAST_MOTION_CYCLE_SECONDS * 0.14);
    const hitSettled = sampleBeastMotionCycle("hit", BEAST_MOTION_CYCLE_SECONDS * 0.7);
    expect(hitPeak.hitFlinch).toBeGreaterThan(0.9);
    expect(hitSettled.hitFlinch).toBe(0);

    const deathStart = sampleBeastMotionCycle("death", 0);
    const deathDown = sampleBeastMotionCycle("death", BEAST_MOTION_CYCLE_SECONDS * 0.7);
    expect(deathStart.deathProgress).toBe(0);
    expect(deathDown.deathProgress).toBe(1);
  });

  it("binds normalized hybrid skin weights and poses all 19 beasts cleanly", () => {
    const { geometry, bounds } = sampleBeastGeometry();
    for (const species of BEAST_MOTION_SPECIES_LIST) {
      const skinned = applyBeastSpatialSkinning(geometry, species, bounds, "hybrid");
      const weights = skinned.getAttribute("skinWeight");
      const indices = skinned.getAttribute("skinIndex");
      for (let i = 0; i < weights.count; i++) {
        const sum = weights.getX(i) + weights.getY(i) + weights.getZ(i) + weights.getW(i);
        expect(sum).toBeCloseTo(1, 5);
        expect(indices.getX(i)).toBeLessThan(BEAST_MOTION_HYBRID_BONE_COUNT);
      }
      skinned.dispose();

      const hybridRig = createBeastHybridSkeleton(species, bounds);
      expect(hybridRig.bones).toHaveLength(BEAST_MOTION_HYBRID_BONE_COUNT);
      poseBeastHybridRig(hybridRig, species, "attack", BEAST_MOTION_CYCLE_SECONDS * 0.45);
      expect(hybridRig.boneMap.pelvis.position.z).toBeGreaterThan(hybridRig.restPositions.pelvis.z + 0.2);
      poseBeastHybridRig(hybridRig, species, "death", BEAST_MOTION_CYCLE_SECONDS * 0.7);
      expect(hybridRig.boneMap.pelvis.rotation.z).toBeGreaterThan(1.2);
      hybridRig.skeleton.dispose();
    }

    const fullSkinned = applyBeastSpatialSkinning(geometry, "wyvern", bounds, "full");
    const fullWeights = fullSkinned.getAttribute("skinWeight");
    for (let i = 0; i < fullWeights.count; i++) {
      const sum = fullWeights.getX(i) + fullWeights.getY(i) + fullWeights.getZ(i) + fullWeights.getW(i);
      expect(sum).toBeCloseTo(1, 5);
    }
    fullSkinned.dispose();
    geometry.dispose();
  });

  it("builds full rig clips for every action", () => {
    const fullRig = createFullBeastSkeleton();
    const clips = buildFullBeastRigClips(fullRig.restPositions);
    for (const action of BEAST_MOTION_ACTIONS) {
      expect(clips[action].tracks.length).toBeGreaterThanOrEqual(WYVERN_FULL_RIG_SPECS.length);
      expect(clips[action].duration).toBe(BEAST_MOTION_CYCLE_SECONDS);
    }
    fullRig.skeleton.dispose();
  });

  it("lays out distinct hex positions for 1, 20 and 100 beasts", () => {
    expect(computeHexFormationOffsets(1)).toEqual([{ x: 0, z: 0 }]);
    const twenty = computeHexFormationOffsets(20);
    const hundred = computeHexFormationOffsets(100);
    expect(twenty).toHaveLength(20);
    expect(hundred).toHaveLength(100);
    expect(new Set(hundred.map((p) => `${p.x.toFixed(2)},${p.z.toFixed(2)}`)).size).toBe(100);
  });
});
