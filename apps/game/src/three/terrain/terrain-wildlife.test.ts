import { BiomeType } from "@bibliothecadao/types";
import { type EventDispatcher, type Group, type Mesh, type Object3D, Vector3 } from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createCreatureAnimator } from "./creatures/biome-creature-animator.js";
import { creatureTraits } from "./creatures/biome-creature-catalog";
import { BiomeCreaturePopulation, wildlifeRegion } from "./creatures/biome-creature-population";
import {
  createZebraRigFixture,
  ZEBRA_RIG_FOOT_HEIGHT,
  ZEBRA_RIG_LOWER_LEG,
} from "./creatures/biome-creature-rig.fixture";
import { setWorldOrigin } from "../world-origin";
import { findNearestTerrainHex, terrainHexToWorld } from "./terrain-coordinates";
import { loadBiomeCreature } from "./creatures/biome-creature-assets";
import { TERRAIN_WATER_LEVEL } from "./terrain-water";
import { TerrainWildlife } from "./terrain-wildlife";
import type { TerrainCellInput } from "./terrain-types";

vi.mock("./creatures/biome-creature-assets", async (importOriginal) => {
  const original = await importOriginal<typeof import("./creatures/biome-creature-assets")>();
  const { createZebraRigFixture } = await import("./creatures/biome-creature-rig.fixture");
  return { ...original, loadBiomeCreature: vi.fn(async () => createZebraRigFixture()) };
});

function cells(size = 24): TerrainCellInput[] {
  return Array.from({ length: size * size }, (_, i) => ({
    col: (i % size) - 8,
    row: Math.floor(i / size) - 8,
    biome: i % 2 ? BiomeType.Grassland : BiomeType.TemperateDeciduousForest,
    explored: true,
    occupied: false,
    previewBiome: null,
  }));
}

/** A tundra, a shrubland and a grassland side by side: a fox, a tortoise and a zebra, each on ground it can cross. */
function terrainOfEveryPace(): TerrainCellInput[] {
  const biomes = [BiomeType.Tundra, BiomeType.Shrubland, BiomeType.Grassland];
  return cells().map((cell) => ({ ...cell, biome: biomes[Math.floor((cell.col + 8) / 8)] }));
}

function assertDensity(population: BiomeCreaturePopulation) {
  const occupied = new Set<string>();
  const reserved = new Map<string, number>();
  for (const creature of population.creatures.values()) {
    const region = wildlifeRegion(findNearestTerrainHex(creature.x, creature.z));
    expect(occupied.has(region)).toBe(false);
    occupied.add(region);
    for (const end of [creature.cell, creature.target].filter(Boolean)) {
      const region = wildlifeRegion(end!);
      expect(reserved.get(region) ?? creature.id).toBe(creature.id);
      reserved.set(region, creature.id);
    }
  }
}

describe("biome creature population", () => {
  it("spawns once per aligned 8x8 region, including negative coordinates and overlapping pages", () => {
    const first = new BiomeCreaturePopulation();
    const second = new BiomeCreaturePopulation();
    first.sync(cells());
    second.sync([...cells(), ...cells()].reverse());
    expect([...first.creatures.values()]).toEqual([...second.creatures.values()]);
    expect(first.creatures.size).toBe(9);
    expect(wildlifeRegion({ col: -1, row: -8 })).toBe("-1:-1");
    assertDensity(first);
  });

  it("walks between biome tiles while maintaining the cap and preserving animals through page refresh", () => {
    const population = new BiomeCreaturePopulation();
    population.sync(cells());
    const initial = [...population.creatures.values()].map((creature) => ({ ...creature }));
    const visitedBiomes = new Map<number, Set<number>>();
    for (let i = 0; i < 2400; i++) {
      population.update(0.05);
      if (i % 40 === 0) {
        assertDensity(population);
        for (const creature of population.creatures.values()) {
          const seen = visitedBiomes.get(creature.id) ?? new Set();
          seen.add(creature.cell.col % 2);
          visitedBiomes.set(creature.id, seen);
        }
      }
    }
    expect([...visitedBiomes.values()].some((seen) => seen.size > 1)).toBe(true);
    expect(
      [...population.creatures.values()].some(
        (creature, i) => creature.x !== initial[i].x || creature.z !== initial[i].z,
      ),
    ).toBe(true);
    const before = [...population.creatures.values()];
    population.sync(cells().reverse());
    for (const creature of before) expect(population.creatures.get(creature.id)).toBe(creature);
    assertDensity(population);
  });

  it("does not spawn or traverse hidden, occupied or rejected terrain and releases removed pages", () => {
    const population = new BiomeCreaturePopulation(() => false);
    population.sync(cells());
    expect(population.creatures.size).toBe(0);
    const roaming = new BiomeCreaturePopulation();
    roaming.sync(cells().map((cell) => ({ ...cell, explored: false })));
    expect(roaming.creatures.size).toBe(0);
    roaming.sync(cells().map((cell) => ({ ...cell, occupied: true })));
    expect(roaming.creatures.size).toBe(0);
    roaming.sync(cells());
    expect(roaming.creatures.size).toBeGreaterThan(0);
    roaming.sync([]);
    expect(roaming.creatures.size).toBe(0);
  });

  it("keeps water species in water and land species on land across long roaming sessions", () => {
    const terrain = cells().map((cell) => ({ ...cell, biome: cell.col < 4 ? BiomeType.Ocean : BiomeType.Grassland }));
    const population = new BiomeCreaturePopulation();
    population.sync(terrain);
    for (let i = 0; i < 3000; i++) {
      population.update(0.05);
      for (const creature of population.creatures.values()) {
        expect(creature.cell.col < 4).toBe(creature.species === "green-sea-turtle");
        if (creature.target) expect(creature.target.col < 4).toBe(creature.species === "green-sea-turtle");
      }
    }
  });

  it("can enter a vacant neighboring region without letting a refresh double-spawn there", () => {
    const population = new BiomeCreaturePopulation();
    population.sync(cells());
    const survivor = [...population.creatures.values()][0];
    for (const id of population.creatures.keys()) if (id !== survivor.id) population.creatures.delete(id);
    const origin = wildlifeRegion(survivor.cell);
    let crossed = false;
    for (let step = 0; step < 20000 && !crossed; step++) {
      population.update(0.05);
      assertDensity(population);
      crossed = wildlifeRegion(survivor.cell) !== origin;
    }
    expect(crossed).toBe(true);
    population.sync(cells());
    expect(population.creatures.get(survivor.id)).toBe(survivor);
    assertDensity(population);
  });

  it("clamps resume gaps and caps the total population", () => {
    const first = new BiomeCreaturePopulation(),
      second = new BiomeCreaturePopulation();
    first.sync(cells(64));
    second.sync(cells(64));
    expect(first.creatures.size).toBe(32);
    first.update(1000);
    second.update(0.05);
    expect([...first.creatures.values()]).toEqual([...second.creatures.values()]);
  });
});

describe("biome creature roaming", () => {
  afterEach(() => setWorldOrigin({ col: 0, row: 0 }));

  it("keeps every animal to its own pace, with no jump where a walk ends or the next begins", () => {
    const population = new BiomeCreaturePopulation();
    population.sync(terrainOfEveryPace());
    const fastest = new Map<string, number>();
    for (let frame = 0; frame < 4000; frame++) {
      const before = [...population.creatures.values()].map((creature) => ({ creature, x: creature.x, z: creature.z }));
      population.update(0.05);
      for (const { creature, x, z } of before) {
        const speed = Math.hypot(creature.x - x, creature.z - z) / 0.05;
        expect(speed).toBeLessThanOrEqual(creatureTraits(creature.species).pace * 1.001);
        fastest.set(creature.species, Math.max(fastest.get(creature.species) ?? 0, speed));
      }
    }
    expect(fastest.get("arctic-fox")).toBeGreaterThan(fastest.get("mediterranean-tortoise")! * 4);
    expect(fastest.get("mediterranean-tortoise")).toBeGreaterThan(0);
  });

  it("turns to face its way before it moves off, and never travels sideways", () => {
    const population = new BiomeCreaturePopulation();
    population.sync(cells());
    for (let frame = 0; frame < 2400; frame++) {
      const before = [...population.creatures.values()].map((creature) => ({ creature, x: creature.x, z: creature.z }));
      population.update(0.05);
      for (const { creature, x, z } of before) {
        const moved = Math.hypot(creature.x - x, creature.z - z);
        if (moved < 1e-6) continue;
        const alongHeading = (creature.x - x) * Math.sin(creature.yaw) + (creature.z - z) * Math.cos(creature.yaw);
        expect(alongHeading / moved).toBeGreaterThan(0.999);
      }
    }
  });

  it("stops to do what its species does, and steps only for the ground it covers", () => {
    const population = new BiomeCreaturePopulation();
    population.sync(cells());
    const seen = new Set<string>();
    for (let frame = 0; frame < 6000; frame++) {
      const strides = [...population.creatures.values()].map((creature) => ({ creature, stride: creature.stride }));
      population.update(0.05);
      for (const { creature, stride } of strides) {
        if (creature.speed === 0 && creature.turn === 0) expect(creature.stride).toBe(stride);
        if (!creature.target) {
          expect(creatureTraits(creature.species).idle).toContain(creature.action);
          seen.add(creature.action);
        }
      }
    }
    expect(seen).toEqual(new Set(["stand", "forage", "watch"]));
  });

  it("keeps its place on its tile when the map's origin moves under it", () => {
    const population = new BiomeCreaturePopulation();
    population.sync(cells());
    for (let frame = 0; frame < 400; frame++) population.update(0.05);
    const before = [...population.creatures.values()].map((creature) => ({ creature, x: creature.x, z: creature.z }));
    const tile = terrainHexToWorld(0, 0);
    setWorldOrigin({ col: 64, row: 64 });
    const shift = terrainHexToWorld(0, 0);
    population.restrictTo(cells());
    for (const { creature, x, z } of before) {
      expect(creature.x - x).toBeCloseTo(shift.x - tile.x, 5);
      expect(creature.z - z).toBeCloseTo(shift.z - tile.z, 5);
    }
  });
});

describe("biome creature gait", () => {
  it("leaves a planted foot where it was put down while the body walks on over it", () => {
    const rig = createZebraRigFixture();
    const animator = createCreatureAnimator(rig);
    const knees: Object3D[] = [];
    rig.traverse((joint) => {
      if (joint.userData.joint === "knee") knees.push(joint);
    });
    const planted = new Map<Object3D, number>();
    let plantedSamples = 0;
    for (let distance = 0; distance < 6; distance += 0.01) {
      rig.position.z = distance;
      animator.update(distance, { distance, pace: 1 });
      for (const knee of knees) {
        const foot = knee.localToWorld(new Vector3(0, -ZEBRA_RIG_LOWER_LEG, 0));
        if (foot.y > ZEBRA_RIG_FOOT_HEIGHT + 0.008) {
          planted.delete(knee);
          continue;
        }
        if (!planted.has(knee)) planted.set(knee, foot.z);
        // Under a fiftieth of its leg: the last of its swing as it touches down, and nothing after.
        expect(Math.abs(foot.z - planted.get(knee)!)).toBeLessThan(0.02);
        plantedSamples++;
      }
    }
    // Each foot spends most of every step on the ground, and each is lifted clear to swing forward.
    expect(plantedSamples).toBeGreaterThan(knees.length * 600 * 0.5);
    expect(plantedSamples).toBeLessThan(knees.length * 600 * 0.8);
  });

  it("stands a stopped animal on the ground, with no foot left in the air", () => {
    const rig = createZebraRigFixture();
    const animator = createCreatureAnimator(rig);
    animator.update(0, { distance: 0.7, pace: 1 });
    for (let time = 0.05; time < 3; time += 0.05) animator.update(time, { distance: 0.7, pace: 0, action: "forage" });
    rig.traverse((joint) => {
      if (joint.userData.joint !== "knee") return;
      const foot = joint.localToWorld(new Vector3(0, -ZEBRA_RIG_LOWER_LEG, 0));
      expect(foot.y).toBeCloseTo(ZEBRA_RIG_FOOT_HEIGHT, 2);
    });
  });
});

describe("terrain wildlife lifecycle", () => {
  it("disposes a model that finishes loading after its terrain has been released", async () => {
    const template = await loadBiomeCreature("plains-zebra", () => {});
    const mesh = template.children[0].children[0] as Mesh;
    const disposeGeometry = vi.spyOn(mesh.geometry, "dispose");
    let finish!: (root: Group) => void;
    vi.mocked(loadBiomeCreature).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const wildlife = new TerrainWildlife(
      () => ({ biome: BiomeType.Grassland, height: 0, normal: [0, 1, 0] }),
      () => {},
    );
    wildlife.sync(
      cells().map((cell) => ({ ...cell, biome: BiomeType.Grassland })),
      [],
    );
    const loading = wildlife.load();
    wildlife.dispose();
    finish(template);
    await loading;
    expect(disposeGeometry).toHaveBeenCalledOnce();
    expect(wildlife.getStats().loaded).toBe(0);
    expect(wildlife.object3d.children).toHaveLength(0);
  });

  it("shares templates, gives every animal its own joints, freezes hidden wildlife and clears released views", async () => {
    const wildlife = new TerrainWildlife(
      () => ({ biome: BiomeType.Grassland, height: 0, normal: [0, 1, 0] }),
      () => {},
    );
    wildlife.sync(cells(), []);
    await wildlife.load();
    expect(wildlife.getStats().loaded).toBe(9);
    expect(wildlife.object3d.children[0].children[0]).not.toBe(wildlife.object3d.children[1].children[0]);
    const before = wildlife.getStats();
    wildlife.object3d.visible = false;
    wildlife.update(20);
    expect(wildlife.getStats().creatures).toEqual(before.creatures);
    // A released animal's meshes fire dispose, which frees their render objects; the shared template stays.
    const releasedMeshes: Object3D[] = [];
    wildlife.object3d.children[0].traverse((object) => {
      if ((object as Mesh).isMesh) releasedMeshes.push(object);
    });
    const released = vi.fn();
    for (const mesh of releasedMeshes)
      (mesh as unknown as EventDispatcher<{ dispose: object }>).addEventListener("dispose", released);
    wildlife.sync([], []);
    expect(wildlife.getStats().loaded).toBe(0);
    expect(releasedMeshes.length).toBeGreaterThan(0);
    expect(released).toHaveBeenCalledTimes(releasedMeshes.length);
    wildlife.dispose();
    expect(wildlife.object3d.children).toHaveLength(0);
  });
});

it.each([BiomeType.DeepOcean, BiomeType.Ocean])(
  "keeps aquatic wildlife partly submerged in biome %s",
  async (biome) => {
    const wildlife = new TerrainWildlife(
      () => ({ biome, height: TERRAIN_WATER_LEVEL, normal: [0, 1, 0] }),
      () => {},
    );
    try {
      wildlife.sync(
        cells().map((cell) => ({ ...cell, biome })),
        [],
      );
      await wildlife.load();
      expect(wildlife.object3d.children.length).toBeGreaterThan(0);
      for (let frame = 0; frame < 20; frame++) {
        wildlife.update(0.05);
        for (const creature of wildlife.object3d.children) {
          expect(creature.position.y).toBeLessThan(TERRAIN_WATER_LEVEL);
        }
      }
    } finally {
      wildlife.dispose();
    }
  },
);
