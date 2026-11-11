import {
  findNearestTerrainHex,
  terrainCellKey,
  terrainHexToWorld,
  terrainNeighborCoordinates,
} from "../terrain-coordinates";
import { hashTerrainCoordinates, terrainHashToUnitFloat } from "../terrain-hash";
import type { TerrainCellInput } from "../terrain-types";
import { isTerrainWaterBiome } from "../terrain-water";
import { creatureForBiome, creatureTraits, type CreatureSpecies, type CreatureTraits } from "./biome-creature-catalog";
import {
  beginHuntIfHungry,
  fears,
  FIRST_HUNGER,
  pursueHunt,
  stealthOf,
  type HuntingGround,
} from "./biome-creature-hunt";
import {
  bearingTo,
  comeToRest,
  goalInWorld,
  moveOntoTile,
  offsetBetween,
  placeInWorld,
  setOff,
  walk,
  wildlifeRegion,
  type Cell,
  type CreatureMood,
  type Point,
  type RoamingCreature,
} from "./biome-creature-motion";

export { wildlifeRegion, type RoamingCreature } from "./biome-creature-motion";

/**
 * Something animals keep clear of: an army on the map, while it moves. One camped on their ground is part of the land to
 * them: on a small Frontier site an army always stands near, and animals that feared it would only ever stand and watch.
 */
export interface WildlifeThreat extends Point {
  moving: boolean;
}

type PathCheck = (from: Point, to: Point, species: CreatureSpecies) => boolean;
interface Danger {
  distance: number;
  at: Point | null;
}
/** The nearest danger to each animal, and to each herd through whichever of its members is nearest one. */
interface Dangers {
  own: Map<number, Danger>;
  herd: Map<number, Danger>;
}

const MAX_CREATURES = 48;
/** How far from its tile's centre an animal may stand: no two visits end on the same spot. */
const STANDING_SPOT_RADIUS = 0.28;
/** An animal is wary of danger this many times further off than the distance at which it acts. */
const WARY_REACH = 1.7;
/** How far from its leader a herd member keeps, in its own sizes, and how far it may drift before it closes up. */
const STATION_DISTANCE = 1.15;
const STATION_SLACK = 0.6;
const YOUNG_STATION_SHARE = 0.65;
/** Seconds an animal looks back after a flight, and before it looks again for a way after finding none. */
const LOOK_BACK_SECONDS = 3;
const RETRY_SECONDS = 1;
const NO_DANGER: Danger = { distance: Infinity, at: null };

/** The animal a creature's herd is counted by: its leader, or itself; a kill is counted with its hunter. */
export function herdOf(creature: RoamingCreature): number {
  return creature.caughtBy ?? creature.leader ?? creature.id;
}

/** The tile whose region a herd's leader holds: where it is, or where it set out from on a hunt. */
export function homeTile(leader: RoamingCreature): Cell {
  return leader.hunt?.den ?? leader.cell;
}

/**
 * Cosmetic state derived only from presented terrain: herds roam, one to a region, and keep clear of armies. A herd's
 * leader reserves both ends of every move; the rest keep station on it.
 */
export class BiomeCreaturePopulation {
  readonly creatures = new Map<number, RoamingCreature>();
  private cells = new Map<string, TerrainCellInput>();
  private threats: readonly WildlifeThreat[] = [];
  private nextId = 0;
  /** The ground as a hunt sees it: a hunter goes where its kind may stand, whoever's region that is. */
  private readonly huntingGround: HuntingGround = {
    creatures: this.creatures,
    canStand: (tile, species) => this.canVisit(tile, species),
    isPathClear: (from, to, species) => this.isPathClear(from, to, species),
    tilesBeside: (creature) =>
      terrainNeighborCoordinates(creature.cell.col, creature.cell.row).filter((tile) =>
        this.canVisit(tile, creature.species),
      ),
    spotOn: standingSpotInWorld,
    remove: (id) => this.creatures.delete(id),
    // A herd that loses its leader in a frame is regrouped once the frame is over (`update`).
    regroup: () => {
      this.herdsChanged = true;
    },
  };
  /** Set when a herd lost its leader during this frame's update. */
  private herdsChanged = false;

  constructor(private readonly isPathClear: PathCheck = () => true) {}

  sync(cells: readonly TerrainCellInput[]): void {
    this.restrictTo(cells);
    for (const [id, creature] of this.creatures) {
      if (creature.target && !this.isPathClear(creature, goalInWorld(creature), creature.species))
        this.creatures.delete(id);
    }
    this.promoteOrphans();
    this.fillVacantRegions();
  }

  /** Immediately remove invalid residents; terrain commits defer costly ambient spawning until update/load. */
  restrictTo(cells: readonly TerrainCellInput[]): void {
    this.cells = new Map(cells.map((cell) => [terrainCellKey(cell.col, cell.row), cell]));
    this.removeInvalidCreatures();
    this.promoteOrphans();
    for (const creature of this.creatures.values()) placeInWorld(creature);
  }

  /** The armies now on the map: animals watch the near ones and give way to the nearest. */
  setThreats(threats: readonly WildlifeThreat[]): void {
    this.threats = threats;
  }

  update(deltaSeconds: number): void {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return;
    const dt = Math.min(deltaSeconds, 0.05);
    const reserved = this.reservedRegions();
    const dangers = this.senseDangers();
    for (const creature of this.creatures.values()) {
      creature.age += dt;
      creature.sinceSetOff += dt;
      creature.blockedFor = Math.max(0, creature.blockedFor - dt);
      creature.hunger = Math.max(0, creature.hunger - dt);
      // A kill lies where it fell until its hunter has fed.
      if (creature.caughtBy === null) this.live(creature, dt, reserved, dangers);
      else comeToRest(creature, dt);
      placeInWorld(creature);
    }
    // Every animal of a frame reads the herds the frame began with; a herd that lost its leader follows its heir from
    // the next frame, never halfway through this one.
    if (this.herdsChanged) {
      this.herdsChanged = false;
      this.promoteOrphans();
    }
  }

  /** One frame of an animal's life: it takes fright or not, moves, and decides what comes next. */
  private live(creature: RoamingCreature, dt: number, reserved: Set<string>, dangers: Dangers): void {
    this.takeFright(creature, dangers.own.get(creature.id)!, dangers.herd.get(herdOf(creature))!);
    if (creature.target) {
      if (walk(creature, dt)) this.settle(creature);
    } else comeToRest(creature, dt);
    placeInWorld(creature);
    // A hunt has the hunter until it is over; only real alarm breaks into one, and nothing breaks into a meal.
    if (creature.hunt && (creature.mood !== "alarmed" || creature.hunt.phase === "feed"))
      return pursueHunt(creature, dt, this.huntingGround);
    // Asked in the frame it arrives too, so an animal that walks on keeps its pace across the tile.
    if (creature.target) return;
    if (creature.leader === null) this.leadOn(creature, dt, reserved, dangers.herd.get(creature.id)!);
    else this.keepStation(creature, dt);
  }

  // ── Who lives where ──────────────────────────────────────────────────────────────────────────────────────────────

  private removeInvalidCreatures(): void {
    for (const [id, creature] of this.creatures) {
      if (
        !this.canVisit(creature.cell, creature.species) ||
        (creature.target && !this.canVisit(creature.target, creature.species))
      ) {
        this.creatures.delete(id);
      }
    }
  }

  /** A herd that lost its leader, gone or brought down, follows its eldest instead; a kill goes with its hunter. */
  private promoteOrphans(): void {
    const heirs = new Map<number, RoamingCreature>();
    for (const [id, creature] of this.creatures) {
      if (creature.caughtBy !== null && !this.creatures.has(creature.caughtBy)) this.creatures.delete(id);
      if (creature.leader === null || creature.caughtBy !== null) continue;
      if (this.creatures.get(creature.leader)?.caughtBy === null) continue;
      const heir = heirs.get(creature.leader);
      if (heir) creature.leader = heir.id;
      else {
        heirs.set(creature.leader, creature);
        creature.leader = null;
        creature.station = { x: 0, z: 0 };
      }
    }
  }

  private fillVacantRegions(): void {
    const reserved = this.reservedRegions();
    const candidates = [...this.cells.values()]
      .map((cell) => ({ cell, priority: priority(cell, 0) }))
      .toSorted((a, b) => a.priority - b.priority || a.cell.row - b.cell.row || a.cell.col - b.cell.col)
      .map(({ cell }) => cell);
    for (const cell of candidates) {
      if (this.creatures.size >= MAX_CREATURES) break;
      const region = wildlifeRegion(cell);
      const species = creatureForBiome(cell.biome);
      if (!species || reserved.has(region) || !this.canVisit(cell, species)) continue;
      const leader = createRoamingCreature(this.nextId, species, cell);
      if (!this.isPathClear(leader, leader, species)) continue;
      this.nextId++;
      this.creatures.set(leader.id, leader);
      reserved.add(region);
      this.gatherHerd(leader);
    }
  }

  /** Spawns the rest of a leader's herd on the stations round it that they can reach. */
  private gatherHerd(leader: RoamingCreature): void {
    const traits = creatureTraits(leader.species);
    if (!traits.herd) return;
    const [fewest, most] = traits.herd;
    const size = fewest + Math.floor(priority(leader.cell, 7) * (most - fewest + 1));
    const hasYoung = size > 1 && priority(leader.cell, 8) < (traits.young ?? 0);
    for (let member = 1; member < size && this.creatures.size < MAX_CREATURES; member++) {
      const follower = createRoamingCreature(this.nextId, leader.species, leader.cell);
      follower.leader = leader.id;
      follower.young = hasYoung && member === size - 1;
      follower.station = stationBeside(traits, follower.young, member, size, priority(leader.cell, 9));
      follower.yaw = priority(leader.cell, 10 + member) * Math.PI * 2;
      const station = this.reachableStation(follower, leader);
      if (!station) continue;
      moveOntoTile(follower, findNearestTerrainHex(station.x, station.z));
      follower.offset = offsetBetween(follower.cell, station);
      follower.goal = follower.offset;
      placeInWorld(follower);
      this.nextId++;
      this.creatures.set(follower.id, follower);
    }
  }

  private canVisit(coordinate: Cell, species: CreatureSpecies): boolean {
    const cell = this.cells.get(terrainCellKey(coordinate.col, coordinate.row));
    if (!cell?.explored || cell.occupied || !creatureForBiome(cell.biome)) return false;
    const mode = creatureTraits(species).movement;
    if (mode !== "air" && isTerrainWaterBiome(cell.biome) !== (mode === "water")) return false;
    // A full visible ring keeps the articulated body from projecting into unrevealed or occupied cells.
    return terrainNeighborCoordinates(cell.col, cell.row).every((neighbor) => {
      const adjacent = this.cells.get(terrainCellKey(neighbor.col, neighbor.row));
      return adjacent?.explored && !adjacent.occupied;
    });
  }

  /** The regions herds hold: where each leader is, and where it is going. */
  private reservedRegions(): Set<string> {
    const reserved = new Set<string>();
    for (const creature of this.creatures.values()) {
      if (creature.leader !== null || creature.caughtBy !== null) continue;
      // A hunter away on a hunt holds the region it left, and none of those it crosses.
      if (creature.hunt) reserved.add(wildlifeRegion(creature.hunt.den));
      else {
        reserved.add(wildlifeRegion(creature.cell));
        if (creature.target) reserved.add(wildlifeRegion(creature.target));
      }
    }
    return reserved;
  }

  // ── Danger ───────────────────────────────────────────────────────────────────────────────────────────────────────

  /** The nearest danger to each animal, and to each herd through whichever of its members is nearest one. */
  private senseDangers(): Dangers {
    const own = new Map<number, Danger>();
    const herd = new Map<number, Danger>();
    const hunters = [...this.creatures.values()].filter((creature) => creatureTraits(creature.species).hunts);
    for (const creature of this.creatures.values()) {
      // A kill fears nothing more, and is no part of what its hunter's herd feels.
      if (creature.caughtBy !== null) continue;
      const danger = nearestDanger(creature, this.threats, hunters);
      own.set(creature.id, danger);
      const felt = herd.get(herdOf(creature));
      if (!felt || danger.distance < felt.distance) herd.set(herdOf(creature), danger);
    }
    return { own, herd };
  }

  /** Sets what danger makes of an animal: wary as it nears, alarmed with its herd once any of them is too close. */
  private takeFright(creature: RoamingCreature, own: Danger, herd: Danger): void {
    const nerve = creatureTraits(creature.species).nerve;
    const wasAlarmed = creature.mood === "alarmed";
    // Once alarmed it stays so until the danger is well clear, or it would stop and start at the edge of its nerve.
    const alarmed = herd.distance < nerve * (wasAlarmed ? WARY_REACH : 1);
    const mood: CreatureMood = alarmed ? "alarmed" : own.distance < nerve * WARY_REACH ? "wary" : "calm";
    creature.mood = mood;
    creature.gaze = mood !== "calm" && own.at ? bearingTo(creature, own.at) : null;
    if (alarmed && !wasAlarmed) this.startle(creature);
  }

  /** An animal that takes fright mid-walk does not finish its stroll: it stops where it is, to run, hide or watch. */
  private startle(creature: RoamingCreature): void {
    if (!creature.target) return;
    const under = findNearestTerrainHex(creature.x, creature.z);
    const reached = under.col === creature.target.col && under.row === creature.target.row;
    moveOntoTile(creature, reached ? creature.target : creature.cell);
  }

  // ── What a leader does next ──────────────────────────────────────────────────────────────────────────────────────

  private leadOn(creature: RoamingCreature, dt: number, reserved: Set<string>, danger: Danger): void {
    if (creature.mood === "alarmed") return this.meetDanger(creature, reserved, danger);
    if (creature.haste > 1) return lookBack(creature);
    if (creature.mood === "calm" && beginHuntIfHungry(creature, this.huntingGround)) return;
    // Wary, it watches for as long as it would have grazed, then moves on as it meant to.
    if (creature.mood === "wary") standWary(creature);
    if ((creature.wait -= dt) <= 0) this.chooseDestination(creature, reserved);
  }

  private meetDanger(creature: RoamingCreature, reserved: Set<string>, danger: Danger): void {
    standWary(creature);
    if (creatureTraits(creature.species).fright !== "flee" || !danger.at || creature.blockedFor > 0) return;
    const escape = this.findEscape(creature, reserved, danger.at);
    // Cornered, it can only face what it fears, and look again for a way out.
    if (!escape) {
      creature.blockedFor = RETRY_SECONDS;
      return;
    }
    setOff(creature, escape, standingSpotInWorld(escape));
    creature.haste = creatureTraits(creature.species).sprint;
    creature.stopping = false;
    reserved.add(wildlifeRegion(escape));
  }

  /** The neighbouring tile it can reach that puts the most ground between it and the danger. */
  private findEscape(creature: RoamingCreature, reserved: Set<string>, danger: Point): Cell | undefined {
    const here = Math.hypot(creature.x - danger.x, creature.z - danger.z);
    return this.openNeighbours(creature, reserved)
      .map((cell) => {
        const spot = standingSpotInWorld(cell);
        return { cell, clear: Math.hypot(spot.x - danger.x, spot.z - danger.z) };
      })
      .filter(({ clear }) => clear > here + 0.2)
      .toSorted((a, b) => b.clear - a.clear)
      .find(({ cell }) => this.isPathClear(creature, standingSpotInWorld(cell), creature.species))?.cell;
  }

  private chooseDestination(creature: RoamingCreature, reserved: Set<string>): void {
    const seed = creature.steps + creature.id + 3;
    const target = this.openNeighbours(creature, reserved)
      .toSorted((a, b) => priority(a, seed) - priority(b, seed))
      .find((cell) => this.isPathClear(creature, standingSpotInWorld(cell), creature.species));
    if (!target) {
      creature.steps++;
      creature.wait = RETRY_SECONDS * 2;
      if (creature.mood === "calm") creature.action = "stand";
      return;
    }
    setOff(creature, target, standingSpotInWorld(target));
    creature.stopping = priority(target, seed + 11) >= creatureTraits(creature.species).wanderlust;
    reserved.add(wildlifeRegion(target));
  }

  /** The tiles beside it that its kind may stand on and no other herd holds. */
  private openNeighbours(creature: RoamingCreature, reserved: Set<string>): Cell[] {
    const home = wildlifeRegion(creature.cell);
    // A hunter caught far from home by an army runs where it can: its own region is held for it.
    const roams = creature.hunt !== null;
    return terrainNeighborCoordinates(creature.cell.col, creature.cell.row).filter(
      (cell) =>
        (roams || wildlifeRegion(cell) === home || !reserved.has(wildlifeRegion(cell))) &&
        this.canVisit(cell, creature.species),
    );
  }

  /** A walk's end: the animal picks what to do there, or walks straight on. */
  private settle(creature: RoamingCreature): void {
    if (!creature.stopping) {
      creature.wait = 0;
      return;
    }
    const traits = creatureTraits(creature.species);
    const seed = creature.steps + creature.id;
    creature.action = traits.idle[Math.floor(priority(creature.cell, seed) * traits.idle.length)];
    creature.wait = traits.pause[0] + priority(creature.cell, creature.steps) * (traits.pause[1] - traits.pause[0]);
  }

  // ── What a herd member does next ─────────────────────────────────────────────────────────────────────────────────

  /** Keeps a herd member beside its leader: it closes up once the leader has moved on, sooner if the herd is in flight. */
  private keepStation(creature: RoamingCreature, dt: number): void {
    const leader = this.creatures.get(creature.leader!)!;
    const traits = creatureTraits(creature.species);
    const fleeing = leader.haste > 1;
    const station = stationInWorld(creature, leader);
    const adrift = Math.hypot(station.x - creature.x, station.z - creature.z) > traits.size * STATION_SLACK;
    if (!adrift) {
      if (!fleeing && creature.haste > 1) return lookBack(creature);
      if (creature.mood !== "calm") return standWary(creature);
      // In place and at ease, it changes what it is doing now and then, as its herd does.
      if ((creature.wait -= dt) <= 0) this.settle(creature);
      return;
    }
    // Each member takes its own moment to notice the leader has gone.
    const noticed = fleeing || !leader.target || leader.sinceSetOff >= reactionSeconds(creature);
    if (!noticed || creature.blockedFor > 0) return;
    const reachable = this.reachableStation(creature, leader);
    if (!reachable) {
      creature.blockedFor = RETRY_SECONDS;
      return;
    }
    setOff(creature, findNearestTerrainHex(reachable.x, reachable.z), reachable);
    creature.haste = fleeing ? traits.sprint : 1;
    creature.stopping = !fleeing;
  }

  /** The member's station if it can walk there, else the nearest place round its leader that it can. */
  private reachableStation(creature: RoamingCreature, leader: RoamingCreature): Point | undefined {
    const anchor = goalInWorld(leader);
    for (const share of [1, 0.5])
      for (const swing of [0, 1, -1, 2, -2, 3]) {
        const angle = (swing * Math.PI) / 3;
        const x = (creature.station.x * Math.cos(angle) + creature.station.z * Math.sin(angle)) * share;
        const z = (creature.station.z * Math.cos(angle) - creature.station.x * Math.sin(angle)) * share;
        const station = { x: anchor.x + x, z: anchor.z + z };
        if (
          this.canVisit(findNearestTerrainHex(station.x, station.z), creature.species) &&
          this.isPathClear(creature, station, creature.species)
        )
          return station;
      }
    return undefined;
  }
}

/** The nearest thing an animal fears: an army on the move, or for prey a hunter. */
function nearestDanger(
  creature: RoamingCreature,
  threats: readonly WildlifeThreat[],
  hunters: readonly RoamingCreature[],
): Danger {
  let nearest = NO_DANGER;
  for (const threat of threats) {
    if (!threat.moving) continue;
    const distance = Math.hypot(threat.x - creature.x, threat.z - creature.z);
    if (distance < nearest.distance) nearest = { distance, at: threat };
  }
  for (const hunter of hunters) {
    if (!fears(creature, hunter)) continue;
    const distance = Math.hypot(hunter.x - creature.x, hunter.z - creature.z) * stealthOf(hunter);
    if (distance < nearest.distance) nearest = { distance, at: hunter };
  }
  return nearest;
}

/** While danger is near it does nothing else: withdrawn if that is its way, else watching it. */
function standWary(creature: RoamingCreature): void {
  creature.action = creatureTraits(creature.species).fright === "hide" ? "rest" : "watch";
}

/** A flight's end: it turns to watch what it ran from before it goes back to its day. */
function lookBack(creature: RoamingCreature): void {
  creature.haste = 1;
  creature.action = "watch";
  creature.wait = LOOK_BACK_SECONDS;
}

/** Seconds a herd member takes to follow once its leader walks on. */
function reactionSeconds(creature: RoamingCreature): number {
  return 0.3 + ((creature.id * 0.618034) % 1) * 1.2;
}

/** Where a member keeps to: its leader's destination, or its place if it is stopped, plus the member's station. */
function stationInWorld(creature: RoamingCreature, leader: RoamingCreature): Point {
  const anchor = goalInWorld(leader);
  return { x: anchor.x + creature.station.x, z: anchor.z + creature.station.z };
}

/** A member's station: spread round the leader with the rest, the young closest. */
function stationBeside(traits: CreatureTraits, young: boolean, member: number, herdSize: number, turn: number): Point {
  const angle = (turn + member / (herdSize - 1)) * Math.PI * 2;
  const distance = traits.size * STATION_DISTANCE * (young ? YOUNG_STATION_SHARE : 1);
  return { x: Math.sin(angle) * distance, z: Math.cos(angle) * distance };
}

function standingSpotInWorld(cell: Cell): Point {
  const centre = terrainHexToWorld(cell.col, cell.row);
  const spot = standingSpot(cell);
  return { x: centre.x + spot.x, z: centre.z + spot.z };
}

/** Where on a tile an animal stands: a spot of its own, off the centre. */
function standingSpot(cell: Cell): Point {
  const angle = priority(cell, 5) * Math.PI * 2;
  const radius = STANDING_SPOT_RADIUS * Math.sqrt(priority(cell, 6));
  return { x: Math.sin(angle) * radius, z: Math.cos(angle) * radius };
}

function priority(cell: Cell, seed: number): number {
  return terrainHashToUnitFloat(
    hashTerrainCoordinates({ ...cell, elevationSeed: 0, moistureSeed: 0, salt: `biome-creature:${seed}` }),
  );
}

function createRoamingCreature(id: number, species: CreatureSpecies, cell: Cell): RoamingCreature {
  const offset = standingSpot(cell);
  const creature: RoamingCreature = {
    id,
    species,
    cell: { col: cell.col, row: cell.row },
    target: null,
    x: 0,
    z: 0,
    yaw: priority(cell, 2) * Math.PI * 2,
    speed: 0,
    turn: 0,
    stride: 0,
    lift: 0,
    action: "stand",
    wait: 1 + priority(cell, 1) * 3,
    steps: 0,
    age: 0,
    sinceSetOff: 0,
    offset,
    goal: offset,
    stopping: true,
    haste: 1,
    mood: "calm",
    gaze: null,
    blockedFor: 0,
    leader: null,
    station: { x: 0, z: 0 },
    young: false,
    hunt: null,
    hunger: FIRST_HUNGER[0] + priority(cell, 12) * (FIRST_HUNGER[1] - FIRST_HUNGER[0]),
    caughtBy: null,
  };
  placeInWorld(creature);
  return creature;
}
