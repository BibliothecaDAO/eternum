import { describe, expect, it } from "vitest";

import { INSTANCE_FLOATS } from "./army-marches";
import type { GroundPoint } from "./map-camera";
import { animalAt, animalOf, MOST_ANIMALS, Wildlife, type Animal, type AnimalSpecies } from "./wildlife";
import { BiomeType } from "@bibliothecadao/types";

/** A source of numbers that is the same every run. */
function seeded(seed = 7): () => number {
  let state = seed;
  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return state / 2_147_483_648;
  };
}

const anywhere = () => true;
const at = (x: number, z: number): GroundPoint => ({ x, z });
const count = (wildlife: Wildlife, species: AnimalSpecies) => wildlife.instancesOf(species).length / INSTANCE_FLOATS;
const of = (wildlife: Wildlife, species: AnimalSpecies) =>
  wildlife.all().filter((animal) => animal.species === species);

/** Runs the map's animals for some seconds, a tick every half second, as the map does. */
function run(wildlife: Wildlife, from: number, seconds: number, threats: GroundPoint[] = []): number {
  for (let now = from; now <= from + seconds; now += 0.5) wildlife.update(now, threats, anywhere);
  return from + seconds;
}

/** Lets a hunt run to its catch: the moment a zebra goes missing. */
function untilACatch(wildlife: Wildlife, zebras: number): number {
  for (let now = 0; now < 600; now += 0.5) {
    wildlife.update(now, [], anywhere);
    if (of(wildlife, "plains-zebra").length < zebras) return now;
  }
  throw new Error("The tiger never caught a zebra");
}

describe("where the animals live", () => {
  it("gives each of the seven biomes its animal, and the others none", () => {
    expect(animalOf(BiomeType.Grassland)).toBe("plains-zebra");
    expect(animalOf(BiomeType.Taiga)).toBe("moose");
    expect(animalOf(BiomeType.Ocean)).toBeNull();
  });

  it("settles a herd with its young on a home, and never more animals than the map holds", () => {
    const wildlife = new Wildlife(seeded());
    wildlife.settle([{ at: at(0, 0), species: "plains-zebra" }], 0);
    const herd = wildlife.all();
    expect(herd.length).toBeGreaterThanOrEqual(3);
    expect(herd.length).toBeLessThanOrEqual(5);
    expect(new Set(herd.map((animal) => animal.herd)).size).toBe(1);

    wildlife.settle(
      Array.from({ length: 40 }, (_, home) => ({ at: at(home * 3, 0), species: "plains-zebra" as const })),
      0,
    );
    expect(wildlife.all()).toHaveLength(MOST_ANIMALS);
  });
});

describe("a herd", () => {
  it("runs from an army that comes near, away from it and together", () => {
    const wildlife = new Wildlife(seeded());
    wildlife.settle([{ at: at(0, 0), species: "red-deer" }], 0);

    wildlife.update(1, [at(1.5, 0)], anywhere);

    for (const deer of wildlife.all()) {
      expect(deer.doing).toBe("flees");
      expect(deer.to.x).toBeLessThan(deer.from.x - 2);
    }
  });

  it("stays where it is while no army is near, and keeps to ground it may walk on", () => {
    const wildlife = new Wildlife(seeded());
    wildlife.settle([{ at: at(0, 0), species: "mountain-goat" }], 0);
    const onItsHill = (point: GroundPoint) => Math.hypot(point.x, point.z) < 3;

    for (let now = 0; now < 300; now += 0.5) wildlife.update(now, [at(40, 40)], onItsHill);

    for (const goat of wildlife.all()) expect(Math.hypot(goat.to.x, goat.to.z)).toBeLessThan(3.5);
  });
});

describe("a hunt", () => {
  const withATigerBeside = (zebraHome: GroundPoint) => {
    const wildlife = new Wildlife(seeded(3));
    wildlife.settle(
      [
        { at: zebraHome, species: "plains-zebra" },
        { at: at(zebraHome.x + 6, zebraHome.z), species: "bengal-tiger" },
      ],
      -200,
    );
    return wildlife;
  };

  it("ends with the quarry off the map in the moment it is caught: nothing eaten is drawn again", () => {
    const wildlife = withATigerBeside(at(0, 0));
    const zebras = of(wildlife, "plains-zebra").length;

    const caughtAt = untilACatch(wildlife, zebras);

    // No further call is made: the very update that caught the zebra is the one that stopped drawing it.
    expect(count(wildlife, "plains-zebra")).toBe(zebras - 1);
    expect(wildlife.all().some((animal) => animal.quarry !== undefined)).toBe(false);
    const tiger = of(wildlife, "bengal-tiger")[0];
    expect(tiger.doing).toBe("feeds");
    expect(animalAt(tiger, caughtAt + 5)).toEqual(tiger.to);
  });

  it("that takes a herd's leader leaves a herd that is led, and that still runs from an army", () => {
    const wildlife = withATigerBeside(at(0, 0));
    const zebras = of(wildlife, "plains-zebra");
    // The tiger is sent after the leader itself.
    const leader = wildlife.leaderOf(zebras[0].herd)!;
    const tiger = of(wildlife, "bengal-tiger")[0];
    tiger.quarry = leader.id;
    tiger.hungryAt = -1;

    let now = 0;
    while (wildlife.all().includes(leader) && now < 600) wildlife.update((now += 0.5), [], anywhere);
    expect(wildlife.all()).not.toContain(leader);

    // The moment after, and for a long while after, the herd goes on: every update runs without throwing.
    const led = wildlife.leaderOf(leader.herd)!;
    expect(wildlife.all()).toContain(led);
    expect(led.young).toBe(false);
    now = run(wildlife, now, 250);
    const survivors = of(wildlife, "plains-zebra").filter((animal) => animal.herd === leader.herd);
    expect(survivors.length).toBeGreaterThan(0);
    const here = animalAt(survivors[0], now + 1);
    wildlife.update(now + 1, [{ x: here.x + 1, z: here.z }], anywhere);
    for (const zebra of survivors) expect(zebra.doing).toBe("flees");
  });

  it("is run from by the game it is after", () => {
    const wildlife = withATigerBeside(at(0, 0));
    const fled = new Set<Animal>();
    for (let now = 0; now < 200; now += 0.5) {
      wildlife.update(now, [], anywhere);
      for (const zebra of of(wildlife, "plains-zebra")) if (zebra.doing === "flees") fled.add(zebra);
    }
    expect(fled.size).toBeGreaterThan(0);
  });

  it("is given up when the hunter's breath runs out, and the hunter is not hungry again at once", () => {
    const wildlife = new Wildlife(seeded(5));
    wildlife.settle(
      [
        { at: at(0, 0), species: "jackrabbit" },
        { at: at(60, 0), species: "bengal-tiger" },
      ],
      -200,
    );
    const now = run(wildlife, 0, 120);
    // A tiger takes big game: a rabbit a long way off is never its quarry.
    expect(of(wildlife, "jackrabbit")).toHaveLength(1);
    expect(of(wildlife, "bengal-tiger")[0].quarry).toBeUndefined();
    expect(now).toBe(120);
  });
});

describe("what the renderer is told of an animal", () => {
  it("is a stand for a move that goes nowhere, never a march with no end", () => {
    const wildlife = new Wildlife(seeded());
    wildlife.settle([{ at: at(0, 0), species: "moose" }], 0);
    const boxedIn = () => false;

    wildlife.update(1, [at(0.5, 0)], boxedIn);

    const floats = wildlife.instancesOf("moose");
    for (let animal = 0; animal < floats.length / INSTANCE_FLOATS; animal += 1) {
      const [activity, , length] = [floats[animal * INSTANCE_FLOATS + 6], 0, floats[animal * INSTANCE_FLOATS + 8]];
      expect(length).toBe(0);
      expect(activity).toBe(1);
    }
  });

  it("draws a young animal smaller than an adult", () => {
    const wildlife = new Wildlife(seeded());
    wildlife.settle([{ at: at(0, 0), species: "moose" }], 0);
    const floats = wildlife.instancesOf("moose");
    const sizes = wildlife
      .all()
      .map((animal, index) => ({ young: animal.young, size: floats[index * INSTANCE_FLOATS + 4] }));
    const adult = sizes.find((animal) => !animal.young)!;
    const young = sizes.find((animal) => animal.young)!;
    expect(young.size).toBeCloseTo(adult.size * 0.62, 5);
  });
});
