import { BiomeType } from "@bibliothecadao/types";
import { type EventDispatcher, type Group, type Mesh, type Object3D, Vector3 } from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createCreatureAnimator } from "./creatures/biome-creature-animator.js";
import { creatureTraits } from "./creatures/biome-creature-catalog";
import { BiomeCreaturePopulation, type RoamingCreature, wildlifeRegion } from "./creatures/biome-creature-population";
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

const leaders = (population: BiomeCreaturePopulation) =>
  [...population.creatures.values()].filter((creature) => creature.leader === null && creature.caughtBy === null);

/** One herd to a region: its leader is the only leader there, and holds both ends of its walk alone. */
function assertDensity(population: BiomeCreaturePopulation) {
  const occupied = new Set<string>();
  const reserved = new Map<string, number>();
  for (const creature of leaders(population)) {
    // A hunter away on a hunt still holds the region it left, and only that one.
    const region = wildlifeRegion(creature.hunt?.den ?? findNearestTerrainHex(creature.x, creature.z));
    expect(occupied.has(region)).toBe(false);
    occupied.add(region);
    if (creature.hunt) continue;
    for (const end of [creature.cell, creature.target].filter(Boolean)) {
      const region = wildlifeRegion(end!);
      expect(reserved.get(region) ?? creature.id).toBe(creature.id);
      reserved.set(region, creature.id);
    }
  }
}

describe("biome creature population", () => {
  it("spawns one herd per aligned 8x8 region, including negative coordinates and overlapping pages", () => {
    const first = new BiomeCreaturePopulation();
    const second = new BiomeCreaturePopulation();
    first.sync(cells());
    second.sync([...cells(), ...cells()].reverse());
    expect([...first.creatures.values()]).toEqual([...second.creatures.values()]);
    expect(leaders(first)).toHaveLength(9);
    // Zebra and deer keep company: every region's herd is more than its leader.
    expect(first.creatures.size).toBeGreaterThan(9 * 2 - 1);
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
    const survivor = leaders(population)[0];
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
    expect(first.creatures.size).toBe(48);
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
    expect(fastest.get("arctic-fox")).toBeGreaterThan(fastest.get("mediterranean-tortoise")! * 2);
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
    expect(seen).toEqual(new Set(["stand", "forage", "watch", "rest"]));
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

describe("biome creature herds", () => {
  it("keeps a herd together as it roams, its young closest to the leader", () => {
    const population = new BiomeCreaturePopulation();
    population.sync(cells());
    const apart = (creature: RoamingCreature) => {
      const leader = population.creatures.get(creature.leader!)!;
      return Math.hypot(creature.x - leader.x, creature.z - leader.z);
    };
    const followers = [...population.creatures.values()].filter((creature) => creature.leader !== null);
    expect(followers.some((creature) => creature.young)).toBe(true);
    const furthest = new Map<number, number>();
    for (let frame = 0; frame < 6000; frame++) {
      population.update(0.05);
      for (const creature of followers)
        furthest.set(creature.id, Math.max(furthest.get(creature.id) ?? 0, apart(creature)));
    }
    // A hex is 1.73 across: no member is ever left more than two tiles behind, and each ends back at its station.
    for (const creature of followers) expect(furthest.get(creature.id)).toBeLessThan(3.5);
    for (let frame = 0; frame < 400; frame++) population.update(0.05);
    expect(followers.filter((creature) => apart(creature) < 1.6).length).toBeGreaterThan(followers.length * 0.6);
  });

  it("follows its eldest when the leader is gone, still one herd to its region", () => {
    const population = new BiomeCreaturePopulation();
    population.sync(cells());
    const [leader] = leaders(population);
    const herd = [...population.creatures.values()].filter((creature) => creature.leader === leader.id);
    expect(herd.length).toBeGreaterThan(0);
    population.creatures.delete(leader.id);
    population.restrictTo(cells());
    expect(herd.filter((creature) => creature.leader === null)).toHaveLength(1);
    for (const creature of herd) expect(population.creatures.has(creature.leader ?? creature.id)).toBe(true);
    assertDensity(population);
  });
});

describe("biome creatures and armies", () => {
  const field = (biome: BiomeType) => cells().map((cell) => ({ ...cell, biome }));
  const distance = (creature: RoamingCreature, army: { x: number; z: number }) =>
    Math.hypot(creature.x - army.x, creature.z - army.z);

  it("watches an army that passes at a distance, and goes back to its day when it has gone", () => {
    const population = new BiomeCreaturePopulation();
    population.sync(field(BiomeType.Grassland));
    const [zebra] = leaders(population);
    const army = { x: zebra.x + 3.4, z: zebra.z, moving: true };
    population.setThreats([army]);
    for (let frame = 0; frame < 40; frame++) population.update(0.05);
    expect(zebra.mood).toBe("wary");
    // Its eye is on the army: the way to it, from where the zebra now stands.
    expect(zebra.gaze).toBeCloseTo(Math.atan2(army.x - zebra.x, army.z - zebra.z), 5);
    if (!zebra.target) expect(zebra.action).toBe("watch");
    population.setThreats([]);
    population.update(0.05);
    expect(zebra.mood).toBe("calm");
    expect(zebra.gaze).toBeNull();
  });

  it("runs from an army that comes close, the whole herd with it, and never toward it", () => {
    const population = new BiomeCreaturePopulation();
    population.sync(field(BiomeType.Grassland));
    const [zebra] = leaders(population);
    const herd = [...population.creatures.values()].filter((creature) => (creature.leader ?? creature.id) === zebra.id);
    const army = { x: zebra.x + 1.2, z: zebra.z + 0.4, moving: true };
    const before = herd.map((creature) => distance(creature, army));
    population.setThreats([army]);
    let fastest = 0;
    for (let frame = 0; frame < 200; frame++) {
      const was = distance(zebra, army);
      population.update(0.05);
      fastest = Math.max(fastest, zebra.speed);
      // A leader in flight only ever gains ground on what it flees.
      if (zebra.haste > 1 && zebra.speed > 0.2) expect(distance(zebra, army)).toBeGreaterThan(was - 0.02);
    }
    expect(fastest).toBeGreaterThan(creatureTraits("plains-zebra").pace * 2);
    herd.forEach((creature, index) => expect(distance(creature, army)).toBeGreaterThan(before[index] + 1));
    expect(distance(zebra, army)).toBeGreaterThan(creatureTraits("plains-zebra").nerve);
    assertDensity(population);
  });

  it("lets each species meet danger its own way: the tortoise withdraws, the tiger stands and watches", () => {
    for (const [biome, action] of [
      [BiomeType.Shrubland, "rest"],
      [BiomeType.TropicalSeasonalForest, "watch"],
    ] as const) {
      const population = new BiomeCreaturePopulation();
      population.sync(field(biome));
      const [animal] = leaders(population);
      const place = { x: animal.x, z: animal.z };
      population.setThreats([{ x: animal.x + 0.9, z: animal.z, moving: true }]);
      for (let frame = 0; frame < 100; frame++) population.update(0.05);
      expect(animal.mood).toBe("alarmed");
      expect(animal.action).toBe(action);
      expect(Math.hypot(animal.x - place.x, animal.z - place.z)).toBeLessThan(0.2);
    }
  });

  it("is felt from less far when the army stands still", () => {
    const population = new BiomeCreaturePopulation();
    population.sync(field(BiomeType.Tundra));
    const [fox] = leaders(population);
    const army = { x: fox.x + 2, z: fox.z, moving: false };
    population.setThreats([army]);
    population.update(0.05);
    expect(fox.mood).toBe("wary");
    army.moving = true;
    population.update(0.05);
    expect(fox.mood).toBe("alarmed");
  });
});

describe("biome creature hunts", () => {
  /** Tiger country to the west of open ground: three tigers, each a few tiles from a herd of `prey`. */
  const huntingGround = (prey: BiomeType) =>
    cells().map((cell) => ({ ...cell, biome: cell.col < 0 ? BiomeType.TropicalSeasonalForest : prey }));
  const tigers = (population: BiomeCreaturePopulation) =>
    [...population.creatures.values()].filter((creature) => creature.species === "bengal-tiger");

  it("stalks, charges and brings down slow game, feeds, and goes home; the herd goes on without the one it lost", () => {
    const population = new BiomeCreaturePopulation();
    population.sync(huntingGround(BiomeType.Bare));
    const homes = new Map(tigers(population).map((tiger) => [tiger.id, wildlifeRegion(tiger.cell)]));
    const goats = population.creatures.size - homes.size;
    const phases = new Set<string>();
    const fallen = new Map<number, { x: number; z: number }>();
    let hunting = new Set<number>();
    let hunts = 0;
    for (let frame = 0; frame < 12000; frame++) {
      population.update(0.05);
      const nowHunting = new Set<number>();
      for (const tiger of tigers(population)) {
        if (!tiger.hunt) {
          // A tiger whose hunt has just ended stands in the region it set out from.
          if (hunting.has(tiger.id)) {
            hunts++;
            expect(wildlifeRegion(tiger.cell)).toBe(homes.get(tiger.id));
          }
          continue;
        }
        nowHunting.add(tiger.id);
        phases.add(tiger.hunt.phase);
      }
      hunting = nowHunting;
      for (const creature of population.creatures.values()) {
        if (creature.caughtBy === null) continue;
        // What is brought down stays down, where it fell.
        const place = fallen.get(creature.id) ?? { x: creature.x, z: creature.z };
        fallen.set(creature.id, place);
        expect(Math.hypot(creature.x - place.x, creature.z - place.z)).toBeLessThan(0.3);
      }
      if (frame % 50 === 0) assertDensity(population);
    }
    expect(phases).toEqual(new Set(["approach", "stalk", "charge", "feed", "return"]));
    expect(hunts).toBeGreaterThan(0);
    expect(fallen.size).toBeGreaterThan(0);
    // A kill is gone once its hunter has fed, and every animal left still has a herd to belong to.
    expect(population.creatures.size - homes.size).toBeLessThan(goats);
    for (const creature of population.creatures.values())
      if (creature.leader !== null) expect(population.creatures.get(creature.leader)?.caughtBy).toBeNull();
  });

  it("is seen late when it stalks: game that would bolt from a tiger in the open only watches one that creeps", () => {
    const moodBeside = (stalking: boolean) => {
      const population = new BiomeCreaturePopulation();
      population.sync(huntingGround(BiomeType.Grassland));
      const [tiger] = tigers(population);
      const zebra = leaders(population).find((creature) => creature.species === "plains-zebra")!;
      for (const [id, creature] of population.creatures)
        if (creature !== tiger && creature !== zebra) population.creatures.delete(id);
      // Two world units from the zebra: inside its nerve, outside a tiger's charge.
      tiger.cell = { ...zebra.cell };
      tiger.offset = { x: zebra.offset.x + 2, z: zebra.offset.z };
      tiger.goal = tiger.offset;
      tiger.hunger = 1e6;
      if (stalking) tiger.hunt = { phase: "stalk", quarry: zebra.id, den: { ...tiger.cell }, clock: 0, sinceAim: 0 };
      population.restrictTo(huntingGround(BiomeType.Grassland));
      population.update(0.05);
      return zebra.mood;
    };
    expect(moodBeside(false)).toBe("alarmed");
    expect(moodBeside(true)).toBe("wary");
  });

  it("tires in the charge after fast game and lets it go, to hunt another day", () => {
    const population = new BiomeCreaturePopulation();
    population.sync(huntingGround(BiomeType.Grassland));
    const phases = new Set<string>();
    let fastest = 0;
    for (let frame = 0; frame < 12000; frame++) {
      population.update(0.05);
      for (const tiger of tigers(population)) {
        if (!tiger.hunt) continue;
        phases.add(tiger.hunt.phase);
        if (tiger.hunt.phase === "charge") fastest = Math.max(fastest, tiger.speed);
      }
      if (frame % 50 === 0) assertDensity(population);
    }
    expect(phases.has("charge")).toBe(true);
    expect(phases.has("spent")).toBe(true);
    expect(fastest).toBeGreaterThan(creatureTraits("bengal-tiger").pace * 4);
    for (const tiger of tigers(population)) if (!tiger.hunt) expect(tiger.hunger).toBeGreaterThan(0);
  });
});

describe("biome creature gait", () => {
  it("gallops when it runs: a longer stride, feet still planted where they land, and all four in the air between", () => {
    const rig = createZebraRigFixture();
    const animator = createCreatureAnimator(rig);
    const knees: Object3D[] = [];
    rig.traverse((joint) => {
      if (joint.userData.joint === "knee") knees.push(joint);
    });
    const feet = () => knees.map((knee) => knee.localToWorld(new Vector3(0, -ZEBRA_RIG_LOWER_LEG, 0)));
    // Up to speed first: the gait changes over the first strides of a run.
    let distance = 0;
    for (; distance < 8; distance += 0.01) {
      rig.position.z = distance;
      animator.update(distance, { distance, pace: 3 });
    }
    const planted = new Map<number, number>();
    let airborne = 0;
    for (; distance < 16; distance += 0.01) {
      rig.position.z = distance;
      animator.update(distance, { distance, pace: 3 });
      const now = feet();
      if (now.every((foot) => foot.y > ZEBRA_RIG_FOOT_HEIGHT + 0.03)) airborne++;
      now.forEach((foot, index) => {
        if (foot.y > ZEBRA_RIG_FOOT_HEIGHT + 0.008) return void planted.delete(index);
        if (!planted.has(index)) planted.set(index, foot.z);
        // A ninth of the stride at most: the end of a fast swing as the foot touches down.
        expect(Math.abs(foot.z - planted.get(index)!)).toBeLessThan(0.05);
      });
    }
    expect(airborne).toBeGreaterThan(20);
  });

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
    expect(wildlife.getStats().loaded).toBe(wildlife.getStats().count);
    expect(new Set(wildlife.getStats().creatures.map((creature) => creature.herd)).size).toBe(9);
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
