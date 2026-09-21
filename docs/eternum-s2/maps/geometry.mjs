import fs from "node:fs";
const selectedConfig = JSON.parse(fs.readFileSync(new URL("../config/initial-playtest.json", import.meta.url), "utf8"));
const parameter = (key) => {
  const value = Number(selectedConfig.parameters[key]?.value);
  if (!Number.isInteger(value)) throw new Error(`Missing integer map parameter: ${key}`);
  return value;
};

/** Axial, pointy-top hex geometry shared by the reproducible S2 design maps. */
export const RULES = Object.freeze({
  realmSpacing: parameter("world.map.realm_spacing_primary_hexes"),
  previousExtent: 24,
  extent: parameter("world.map.spire_outermost_realm_ring"),
  spireSpacing: parameter("map.ethereal.spire_spacing_hexes"),
  innerSpireRing: parameter("world.map.spire_inner_realm_ring"),
  firstRealmRing: parameter("world.map.first_realm_ring"),
  mountainFirstRing: parameter("world.mountains.primary_first_ring"),
  mountainLastRing: parameter("world.mountains.primary_last_ring"),
  hyperstructureExcludedThrough: parameter("world.hsf.discovery.excluded_through_primary_ring"),
});

export const DIRECTIONS = [
  [1, 0],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [0, -1],
  [1, -1],
];
export const key = ([q, r]) => `${q},${r}`;
export const distance = ([q, r]) => Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r));
export const scale = ([q, r], amount) => [q * amount, r * amount];
export const neighbors = ([q, r]) => DIRECTIONS.map(([dq, dr]) => [q + dq, r + dr]);
export const corners = (radius) => DIRECTIONS.map((point) => scale(point, radius));
export function disk(radius) {
  const result = [];
  for (let q = -radius; q <= radius; q++) {
    for (let r = Math.max(-radius, -q - radius); r <= Math.min(radius, -q + radius); r++) result.push([q, r]);
  }
  return result;
}
const unique = (points) => [...new Map(points.map((point) => [key(point), point])).values()];
export const halo = (points) => unique(points.flatMap((point) => [point, ...neighbors(point)]));
export const project = ([q, r], size = 1) => [Math.sqrt(3) * (q + r / 2) * size, 1.5 * r * size];

export function buildLayout(rules = RULES) {
  const previousSpires = disk(rules.previousExtent / rules.spireSpacing).map((point) =>
    scale(point, rules.spireSpacing),
  );
  const outerSpires = disk(rules.extent / rules.spireSpacing)
    .filter((point) => distance(point) > 0)
    .map((point) => scale(point, rules.spireSpacing));
  const etherealSpires = unique([...outerSpires, ...corners(rules.innerSpireRing)]);
  const primarySpires = etherealSpires.map((point) => scale(point, rules.realmSpacing));
  const mountains = disk(rules.mountainLastRing).filter((point) => distance(point) >= rules.mountainFirstRing);
  const primaryStructureExploration = halo([[0, 0], ...primarySpires]);
  const primaryPreexplored = unique([...mountains, ...primaryStructureExploration]);
  const etherealPreexplored = unique([[0, 0], ...halo(etherealSpires)]);
  return {
    rules,
    previousSpires,
    previousBanks: corners(21),
    etherealSpires,
    primarySpires,
    mountains,
    primaryStructureExploration,
    primaryPreexplored,
    etherealPreexplored,
    bank: [0, 0],
    reservedEtherealOrigin: [0, 0],
  };
}
