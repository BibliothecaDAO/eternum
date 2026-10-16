/** Realm wonder design, seeded from Structure.entity_id (faith wonder_id). */
const WONDER_CROWNS = ["aureole", "triptych", "crescent", "star", "lantern", "lotus", "fan"];
const PALETTES = [
  {
    name: "ivory-gold",
    stone: [0.88, 0.86, 0.78],
    gold: [0.9, 0.62, 0.2],
    dome: [0.9, 0.62, 0.2],
    crystal: [0.008, 0.24, 0.18],
  },
  {
    name: "silver-teal",
    stone: [0.75, 0.84, 0.9],
    gold: [0.69, 0.61, 0.36],
    dome: [0.045, 0.27, 0.28],
    crystal: [0.012, 0.25, 0.24],
  },
  {
    name: "pearl-bronze",
    stone: [0.91, 0.86, 0.83],
    gold: [0.65, 0.4, 0.16],
    dome: [0.6, 0.36, 0.14],
    crystal: [0.012, 0.29, 0.16],
  },
  {
    name: "white-jade",
    stone: [0.84, 0.91, 0.87],
    gold: [0.88, 0.7, 0.3],
    dome: [0.09, 0.37, 0.28],
    crystal: [0.015, 0.28, 0.22],
  },
];
function wonderSeed(wonderId) {
  if (typeof wonderId === "number" && !Number.isSafeInteger(wonderId))
    throw new Error("Pass the complete wonder entity ID as a bigint or decimal string");
  const text = String(wonderId);
  if (!/^[1-9][0-9]*$/.test(text) || BigInt(text) > 0xffffffffffffffffn)
    throw new Error("Wonder entity ID must be a positive u64");
  let state = 2166136261;
  for (const character of text) state = Math.imul(state ^ character.charCodeAt(0), 16777619) >>> 0;
  return state;
}
export function resolveWonderDesign(wonderId) {
  let state = wonderSeed(wonderId);
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  const crown = WONDER_CROWNS[Math.floor(random() * WONDER_CROWNS.length)];
  const colors = PALETTES[Math.floor(random() * PALETTES.length)];
  const drumHeight = 0.86 + random() * 0.24;
  // Keep the altar below 2.427, preserving crown dimensions and the total height budget.
  const maxDomeHeight = Math.min(1.12, (2.427 - (1.1 + 0.74 * drumHeight) - 0.057) / 0.52);
  const proportions = {
    drumHeight,
    domeHeight: 0.65 + random() * (maxDomeHeight - 0.65),
    width: 0.88 + random() * 0.22,
  };
  const tintStrength = 0.06 + random() * 0.03;
  const brightest = Math.max(...colors.dome);
  const auraTint = colors.dome.map((channel) => 1 - tintStrength * (1 - channel / brightest));
  return {
    wonderId: String(wonderId),
    crown,
    colors,
    proportions,
    auraTint,
  };
}
/** Early wonders keep their age's architecture; only pigments and the shared aura vary by entity. */
export function resolveAgeWonderDesign(tier, wonderId) {
  const design = resolveWonderDesign(wonderId);
  if (tier === "empire") return design;
  const architectures = {
    settlement: ["standing-stone shrine"],
    city: ["sun-dial", "oath-arch"],
    kingdom: ["star-lantern", "twin-guardians"],
  };
  if (!(tier in architectures)) throw new Error(`Unknown realm age: ${tier}`);
  return {
    wonderId: design.wonderId,
    crown: architectures[tier][wonderSeed(wonderId) % architectures[tier].length],
    colors: design.colors,
    roofTint: design.auraTint.map((channel) => 1 - 2.5 * (1 - channel)),
    auraTint: design.auraTint,
  };
}
