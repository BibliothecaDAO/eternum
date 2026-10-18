/**
 * A nameless place's name on its plate (the owner, 18 October 2026: "name the camps so a little number -> text algo (check
 * the lore), client only of course, it'd make the world more lively. But not too long names"): one word of two halves
 * from the lore's words, read off its entity id, so every player sees the same name for the same camp or rift and no
 * raw id is ever shown.
 *
 * The first half is the world the Realms stand in: the mist and its veil, the spires and their orbs, the Orders' rage
 * and titans, the Loot names' grim and dread, the resources' coal, iron and ruby. The second is a Loot name's ending
 * (bane, bite, grasp, roar, song, tear) or a place in the wilds (crag, ford, hold, mere, reach).
 */
const FIRST = [
  "Ash",
  "Blight",
  "Brim",
  "Coal",
  "Dire",
  "Doom",
  "Dread",
  "Dusk",
  "Ember",
  "Frost",
  "Gale",
  "Gloom",
  "Grim",
  "Iron",
  "Mist",
  "Moon",
  "Orb",
  "Rage",
  "Ruby",
  "Rune",
  "Shade",
  "Skull",
  "Sol",
  "Soul",
  "Spire",
  "Storm",
  "Thorn",
  "Titan",
  "Veil",
  "Woe",
  "Wrath",
  "Wyrm",
] as const;

const SECOND = [
  "bane",
  "bite",
  "crag",
  "deep",
  "fall",
  "fell",
  "ford",
  "gate",
  "glow",
  "grasp",
  "hold",
  "mere",
  "moor",
  "peak",
  "reach",
  "roar",
  "root",
  "song",
  "tear",
  "watch",
] as const;

/** The id's two 32-bit halves (its namespace and serial), mixed so neighbouring serials land far apart. */
const mix = (entityId: number): number => {
  let hash = (entityId % 2 ** 32) ^ Math.imul(Math.floor(entityId / 2 ** 32), 0x9e3779b1);
  hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b);
  hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35);
  return (hash ^ (hash >>> 16)) >>> 0;
};

/** A camp's, a rift's or a ruin's name: one word of two halves, "Grimhold", "Ashreach". */
export const siteName = (entityId: number): string => {
  const hash = mix(entityId);
  const first = FIRST[hash % FIRST.length];
  let second = Math.floor(hash / FIRST.length) % SECOND.length;
  // A doubled letter at the join reads badly ("Gloommere"): the next ending that does not double one takes its place.
  while (first.at(-1) === SECOND[second][0]) second = (second + 1) % SECOND.length;
  return `${first}${SECOND[second]}`;
};

/**
 * A band's second word: what an army is, never a place, so "Iron Wardens" never reads as somewhere to go (the owner,
 * 18 October 2026: armies take a generated name, from words that do not read as a place).
 */
const BAND = [
  "Blades",
  "Brands",
  "Claws",
  "Fangs",
  "Guard",
  "Hammers",
  "Host",
  "Hounds",
  "Lances",
  "Ravens",
  "Reavers",
  "Riders",
  "Shields",
  "Spears",
  "Strikers",
  "Sworn",
  "Wardens",
  "Wolves",
] as const;

/**
 * An army without a given name, named off its id as places are: two words, the world's word and the band's, "Iron
 * Wardens", the same on every client. Its own mix of the id, so an army and a place of one id never share a word.
 */
export const armyName = (entityId: number): string => {
  const hash = mix(entityId ^ 0x5bd1e995);
  return `${FIRST[hash % FIRST.length]} ${BAND[Math.floor(hash / FIRST.length) % BAND.length]}`;
};
