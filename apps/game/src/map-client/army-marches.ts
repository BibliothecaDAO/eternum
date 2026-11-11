import type { GroundPoint } from "./map-camera";

/** The renderer's unit builds: which of the game's models an army is drawn as. */
export const TROOP_BUILDS = ["knight", "crossbowman", "paladin"] as const;
export type TroopBuild = (typeof TROOP_BUILDS)[number];

/** An army as the map draws it: where it stands on the ground, as which build, in which side's colour. */
export interface MapArmy {
  entityId: number;
  at: GroundPoint;
  build: TroopBuild;
  /** The side's colour, linear red, green and blue. */
  tint: readonly [number, number, number];
}

/** A unit's instance as the renderer's unit shader reads it: twenty floats. */
export const INSTANCE_FLOATS = 20;
/** How tall the one unit of an army stands, and how fast it walks to its new hex, in world units a second. */
const ARMY_HEIGHT = 1.03;
const MARCH_SPEED = 0.9;
/** What a unit is and does, as `unit.wgsl` numbers them. */
const KIND: Record<TroopBuild, number> = { knight: 0, crossbowman: 1, paladin: 3 };
const GUARD = 1;
const MARCH = 4;

interface Standing {
  army: MapArmy;
  /** Where its last march set off, when, and which way it faces. */
  from: GroundPoint;
  setOff: number;
  heading: number;
}

const distance = (from: GroundPoint, to: GroundPoint) => Math.hypot(to.x - from.x, to.z - from.z);

/**
 * Where every army stands and where it is walking to. The game's facts say only which hex an army is on; when that
 * changes, the army walks there from wherever it was, and the walk itself is the unit shader's: this keeps the
 * march's start, its heading and the moment it set off.
 */
export class ArmyMarches {
  private readonly standing = new Map<number, Standing>();

  /** Takes the armies as the facts now have them, at the renderer's clock. True when anything changed. */
  update(armies: readonly MapArmy[], seconds: number): boolean {
    let changed = false;
    const present = new Set<number>();
    for (const army of armies) {
      present.add(army.entityId);
      const known = this.standing.get(army.entityId);
      if (!known) {
        this.standing.set(army.entityId, { army, from: army.at, setOff: seconds, heading: 0 });
        changed = true;
      } else if (distance(known.army.at, army.at) > 1e-3) {
        const from = whereAt(known, seconds);
        const heading = Math.atan2(army.at.x - from.x, army.at.z - from.z);
        this.standing.set(army.entityId, { army, from, setOff: seconds, heading });
        changed = true;
      } else if (known.army.build !== army.build || known.army.tint.join() !== army.tint.join()) {
        this.standing.set(army.entityId, { ...known, army });
        changed = true;
      }
    }
    for (const entityId of [...this.standing.keys()]) {
      if (!present.has(entityId)) {
        this.standing.delete(entityId);
        changed = true;
      }
    }
    return changed;
  }

  /** Where every army is at a moment. */
  positions(seconds: number): GroundPoint[] {
    return [...this.standing.values()].map((unit) => whereAt(unit, seconds));
  }

  /** Forgets every army: the ground they stood on is drawn round another origin. */
  forget(): void {
    this.standing.clear();
  }

  /** Every army of one build as the renderer's instances. */
  instancesOf(build: TroopBuild): Float32Array {
    const units = [...this.standing.values()].filter(({ army }) => army.build === build);
    const floats = new Float32Array(units.length * INSTANCE_FLOATS);
    units.forEach((unit, index) => floats.set(instanceOf(unit), index * INSTANCE_FLOATS));
    return floats;
  }
}

/** Where a unit is at a moment of its march. */
function whereAt({ army, from, setOff }: Standing, seconds: number): GroundPoint {
  const length = distance(from, army.at);
  if (length < 1e-6) return army.at;
  const gone = Math.min(Math.max((seconds - setOff) * MARCH_SPEED, 0), length) / length;
  return { x: from.x + (army.at.x - from.x) * gone, z: from.z + (army.at.z - from.z) * gone };
}

function instanceOf({ army, from, setOff, heading }: Standing): number[] {
  const length = distance(from, army.at);
  const marches = length > 1e-3;
  // A number of its own between 0 and 1, the same every frame, by which the shader varies a unit's stance.
  const seed = (Math.sin(army.entityId * 12.9898) * 43758.5453) % 1;
  return [
    ...[from.x, 0, from.z, Math.abs(seed)],
    ...[ARMY_HEIGHT, KIND[army.build], marches ? MARCH : GUARD, heading],
    ...[marches ? length : 0, 0, marches ? MARCH_SPEED : 0, setOff],
    ...[1, 0, 0, 0],
    ...[army.tint[0], army.tint[1], army.tint[2], 1],
  ];
}
