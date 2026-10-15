import { readFileSync } from "node:fs";

const p = (d) => `<path d="${d}"${d.includes("Z") ? "" : ' fill="none" stroke-width="1.8"'}/>`;
const circle = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}"/>`;
const rect = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}"/>`;
const glyph = (body, detail = "", reading = "") => ({ body, detail, reading });
const shapes = {
  stone: glyph(p("M4 18 5 9 11 5 19 8 21 17 15 20Z"), p("M5 9 12 12 19 8M12 12 15 20"), "A quarried stone block"),
  coal: glyph(p("M3 17 6 8 11 5 14 10 19 8 21 18 13 20Z"), p("M6 8 10 14 3 17M14 10 13 20"), "A jagged lump of coal"),
  wood: glyph(p("M5 15 13 4 20 9 12 20Z"), p("M5 15 12 15 12 20M10 13 16 6M13 13 18 9"), "A cut timber log"),
  copper: glyph(
    p("M3 8Q3 3 12 3Q21 3 21 8V16Q21 21 12 21Q3 21 3 16Z"),
    p("M3 8Q3 13 12 13Q21 13 21 8M3 13Q3 18 12 18Q21 18 21 13"),
    "Copper wire coil / loop",
  ),
  ironwood: glyph(
    p("M4 15 13 4 20 9 11 20Z"),
    p("M8 10 15 15M11 7 18 12M4 15 11 15 11 20"),
    "A log bound in iron bands",
  ),
  obsidian: glyph(p("M4 20 7 10 16 3 19 10 17 20Z"), p("M16 3 12 15 4 20M12 15 17 20"), "A sharp volcanic glass shard"),
  gold: glyph(p("M3 17 7 8H17L21 17Z"), p("M5 13H19M9 8 7 13M15 8 17 13"), "A broad gold ingot"),
  silver: glyph(p("M3 18 6 13H20L22 18ZM3 9 6 4H18L21 9Z"), "", "Two slim silver ingots"),
  mithral: glyph(p("M4 18 7 9 16 5 20 14 16 19Z"), p("M7 9 16 11 20 14M16 5V11L16 19"), "A light faceted metal ingot"),
  alchemicalSilver: glyph(
    p("M8 3H16V7L21 17 18 21H6L3 17 8 7Z"),
    p("M6 14H18M10 10H14M12 8V12"),
    "Alchemical metal in a flask",
  ),
  coldIron: glyph(
    p("M3 16 6 10H18L21 16Z") + p("M12 2V8M9 3 15 7M15 3 9 7M7 20H17"),
    "",
    "An iron bar beneath a frost mark",
  ),
  deepCrystal: glyph(
    p("M3 17 5 8 10 11 12 3 17 7 20 17 13 21Z"),
    p("M12 3V18M5 8 8 18M17 7 16 18"),
    "A cluster of deep crystal points",
  ),
  ruby: glyph(p("M6 4H18L21 11 12 21 3 11Z"), p("M3 11H21M6 4 12 11 18 4M12 11V21"), "A broad cut ruby"),
  diamonds: glyph(p("M6 5H18L22 10 12 21 2 10Z"), p("M2 10H22M6 5 9 10 12 21 15 10 18 5"), "A pointed diamond"),
  hartwood: glyph(
    p("M4 7Q8 3 12 8Q16 3 20 7Q23 11 12 21Q1 11 4 7Z"),
    p("M12 10V18M8 11 12 14 16 11"),
    "Heart-shaped living wood",
  ),
  ignium: glyph(
    p("M12 2Q12 8 18 8Q24 16 17 21H7Q0 14 8 8Q8 12 10 10Z"),
    p("M10 16 12 12 15 18 12 20Z"),
    "A burning ember",
  ),
  twilightQuartz: glyph(
    p("M5 18 7 8 12 3 17 8 19 18 12 21Z"),
    p("M14 7Q6 11 14 17Q10 17 9 13Q8 9 14 7"),
    "Quartz marked by a crescent",
  ),
  trueIce: glyph(p("M12 2 20 7V17L12 22 4 17V7Z"), p("M12 5V19M6 9 18 15M6 15 18 9"), "An ice crystal / snowflake"),
  adamantine: glyph(p("M3 8H21L17 13H14V17H19V20H5V17H10V13H7Z"), "", "An unyielding metal anvil"),
  sapphire: glyph(
    p("M12 2 20 8V16L12 22 4 16V8Z"),
    p("M12 2 8 8V16L12 22 16 16V8ZM4 8H20M4 16H20"),
    "A tall hexagonal sapphire",
  ),
  etherealSilica: glyph(
    p("M3 14Q8 5 13 8Q20 2 21 10Q23 18 14 17Q7 23 3 14Z"),
    p("M6 14 11 10 17 12 13 16Z"),
    "A floating wisp around a silica grain",
  ),
  dragonhide: glyph(
    p("M4 3 10 6 14 6 20 3 18 10 21 17 15 18 12 22 9 18 3 17 6 10Z"),
    p("M8 10 12 13 16 10M8 14 12 17 16 14"),
    "A stretched scaled hide",
  ),
  labor: glyph(
    circle(12, 6, 3) + p("M5 21V16L8 12H16L19 16V21Z"),
    p("M8 12 12 17 16 12M12 17V21"),
    "A worker wearing an apron",
  ),
  ancientFragment: glyph(
    p("M5 3H19V10L15 12 18 15 13 21H5Z"),
    p("M9 7H15M9 11H12M9 15V17"),
    "A broken inscribed tablet",
  ),
  donkey: glyph(
    p("M4 12 8 9 12 10 15 7 14 2 17 2 18 6 20 3 22 4 21 11 18 13 17 21H14V16H8V21H5Z"),
    p("M7 11V15H14V11M4 12 2 9"),
    "A long-eared pack donkey",
  ),
  knight: glyph(p("M6 18V9L10 4H16L19 9V18Z"), p("M7 11H18M12 11V18M8 7H17"), "A knight's closed helmet"),
  crossbowman: glyph(
    p("M3 6Q12 0 21 6L19 9Q12 5 5 9ZM10 8H14V19H10Z"),
    p("M12 2V17M7 19H17"),
    "A crossbow with stock and bow",
  ),
  paladin: glyph(p("M4 5 12 2 20 5V12Q19 17 12 20Q5 17 4 12Z"), p("M12 6V16M8 10H16"), "A holy shield with a cross"),
  wheat: glyph(
    p("M12 3 15 7 12 11 9 7ZM6 9 11 11V15L6 13ZM18 9 13 11V15L18 13ZM6 15 11 17V20L6 19ZM18 15 13 17V20L18 19Z"),
    p("M12 7V22"),
    "An ear of wheat",
  ),
  fish: glyph(
    p("M3 12Q10 2 17 9L22 6V18L17 15Q10 22 3 12Z"),
    circle(8, 11, 1) + p("M14 8Q10 12 14 17"),
    "A fish with a forked tail",
  ),
  lords: glyph(circle(12, 12, 9), p("M6 9 9 12 12 7 15 12 18 9 16 16H8Z"), "A crown coin"),
  essence: glyph(
    p("M12 2Q10 6 6 11Q0 21 12 22Q24 21 18 11Z"),
    p("M12 9 8 15 12 19 16 15Z"),
    "A concentrated drop of essence",
  ),
  research: glyph(
    p("M3 5Q8 3 12 6Q16 3 21 5V20Q16 18 12 21Q8 18 3 20Z"),
    p("M12 6V21M6 9H9M15 9H18M6 13H9M15 13H18"),
    "An open research book",
  ),
  sat: glyph(
    circle(12, 12, 9),
    p("M9 6V18M9 7H14Q18 7 16 11L13 12Q19 12 16 17H9M11 4V7M14 4V7M11 17V20M14 17V20"),
    "A Bitcoin coin",
  ),
  stamina: glyph(p("M13 2 4 14H11L10 22 20 9H13Z"), "", "Energy / stamina lightning bolt"),
  attack: glyph(p("M5 20 3 18 15 6 16 2 21 3 22 8 18 9Z"), p("M6 12 12 18"), "A sword striking forward"),
  defend: glyph(p("M4 5 12 2 20 5V12Q19 18 12 22Q5 18 4 12Z"), "", "Protection / a shield"),
  explore: glyph(circle(10, 10, 7) + p("M16 15 22 21 20 23 14 17Z"), p("M7 10H13M10 7V13"), "Search unexplored ground"),
  chest: glyph(p("M3 10Q3 4 8 4H16Q21 4 21 10V21H3Z"), p("M3 11H21M10 9H14V15H10Z"), "A treasure chest"),
  produce: glyph(
    p("M4 8H8V3H12V8H16V3H20V20H4Z"),
    p("M7 13H10M14 13H17M7 17H10M14 17H17"),
    "A workshop producing goods",
  ),
  realm: glyph(p("M3 20V8H6V4H9V8H15V4H18V8H21V20Z"), p("M10 20V14H14V20"), "A fortified realm"),
  village: glyph(
    p("M2 12 7 6 12 12V21H2ZM13 9 18 3 23 9V18H13Z"),
    p("M6 21V15H9V21M17 18V12H20V18"),
    "Two village houses",
  ),
  camp: glyph(p("M2 21 12 3 22 21Z"), p("M12 3V21M7 21 12 12 17 21"), "A triangular camp tent"),
  stragglers: glyph(
    circle(7, 6, 2) + circle(17, 9, 2) + p("M4 11H10V17H8L6 22H3L5 16ZM14 14H20V20H18L16 23H13L15 19Z"),
    "",
    "Two scattered exhausted travellers",
  ),
  shrine: glyph(p("M3 10 12 3 21 10ZM5 12H8V19H5ZM16 12H19V19H16ZM3 21H21"), p("M12 12V18"), "A small pillared shrine"),
  well: glyph(p("M5 13H19V21H5ZM3 7 12 2 21 7Z"), p("M6 7V13M18 7V13M12 7V13M5 17H19"), "A roofed water well"),
  ruin: glyph(p("M3 21V7H8V11H12V4H17V8H21V21Z"), p("M13 8 10 13 15 16 12 21M5 16H8"), "Broken ruined walls"),
  mine: glyph(p("M2 21 8 5H16L22 21H16V14H8V21Z"), p("M5 15 8 10H16L19 15"), "A mine entrance"),
  hyperstructure: glyph(
    p("M3 21 7 10H10L12 2 14 10H17L21 21H15L12 14 9 21Z"),
    p("M6 17H9M15 17H18"),
    "A monumental three-spire structure",
  ),
  spire: glyph(p("M12 2 16 9 15 19 20 22H4L9 19 8 9Z"), p("M8 9H16M10 14H14"), "A single pointed travel spire"),
  bitcoinMine: glyph(
    p("M2 21 7 7H17L22 21H16V14H8V21Z"),
    circle(12, 5, 4) + p("M11 2V8M11 3H14V5H11M11 5H14V7H11"),
    "A mine with a Bitcoin coin",
  ),
  rift: glyph(p("M11 2 5 11 9 13 6 22 19 11 14 9 18 2Z"), p("M12 5 10 10 13 13 10 18"), "A torn portal / rift"),
  bank: glyph(p("M2 8 12 2 22 8ZM3 21H21M5 11V18M12 11V18M19 11V18"), "", "A columned treasury / bank"),
  move: glyph(p("M3 10H14V4L22 12 14 20V14H3Z"), "", "Move right / advance"),
  raid: glyph(
    p("M2 9 8 3H16L22 9 16 15H8Z"),
    p("M6 9H18M9 6 6 9 9 12M15 17V22M11 18 15 22 19 18"),
    "Take loot out of a store",
  ),
  deploy: glyph(p("M3 19H21V22H3ZM10 13V3H14V13H19L12 19 5 13Z"), "", "Place troops onto the field"),
  transfer: glyph(p("M2 6H17V2L22 8 17 13V9H2ZM22 18H7V22L2 16 7 11V15H22Z"), "", "Transfer in both directions"),
  build: glyph(p("M4 6 7 3 16 5 19 8 15 12 11 9 6 21 2 19 8 7Z"), "", "Build with a hammer"),
  claim: glyph(p("M5 2H8V22H5ZM8 3H21L17 8 21 13H8Z"), "", "Claim a place with a flag"),
  upgrade: glyph(p("M3 12 12 3 21 12H15V21H9V12Z"), p("M6 2H18"), "Upgrade to the next level"),
  trade: glyph(p("M3 6H21L19 12H5ZM5 14H19V21H5Z"), p("M2 6 5 2H19L22 6M10 21V16H14V21"), "Trade at a market stall"),
  travel: glyph(
    p("M3 21V10Q3 2 12 2Q21 2 21 10V21H16V10Q16 6 12 6Q8 6 8 10V21Z"),
    p("M11 14H22M19 11 22 14 19 17"),
    "Travel through a portal",
  ),
  strength: glyph(p("M2 8H6V16H2ZM7 10H17V14H7ZM18 8H22V16H18Z"), "", "Strength / a weight"),
  timer: glyph(p("M5 2H19V6L14 12 19 18V22H5V18L10 12 5 6Z"), p("M7 6H17M7 18H17"), "Time remaining / hourglass"),
  health: glyph(p("M4 6Q8 2 12 7Q16 2 20 6Q25 12 12 22Q-1 12 4 6Z"), "", "Health / heart"),
  capacity: glyph(p("M3 8 12 3 21 8V20H3Z"), p("M3 8H21M8 12V18M12 12V18M16 12V18"), "Storage / capacity"),
  warning: glyph(p("M12 2 23 21H1Z"), p("M12 8V14M12 17V18"), "Warning / attention"),
  home: glyph(p("M2 11 12 2 22 11H19V22H5V11Z"), p("M10 22V15H14V22"), "Home"),
  map: glyph(p("M2 5 8 2 16 5 22 2V19L16 22 8 19 2 22Z"), p("M8 2V19M16 5V22"), "A folded map"),
  military: glyph(
    p("M4 3 8 4 20 18 18 21 3 7ZM20 3 16 4 4 18 6 21 21 7Z"),
    p("M3 14 10 21M14 21 21 14"),
    "Armies / crossed swords",
  ),
  settings: glyph(
    p("M9 2H15V5L19 4 22 9 19 12 22 15 19 20 15 19V22H9V19L5 20 2 15 5 12 2 9 5 4 9 5Z"),
    circle(12, 12, 4),
    "Settings / a cog",
  ),
  chat: glyph(p("M2 3H22V18H9L4 23V18H2Z"), p("M6 8H18M6 12H14"), "Chat / speech bubble"),
  leaderboard: glyph(
    p("M7 2H17V11Q17 15 12 16Q7 15 7 11ZM10 16H14V20H19V23H5V20H10Z"),
    p("M7 4H2V9L7 12M17 4H22V9L17 12"),
    "Leaderboard / a trophy",
  ),
  menu: glyph(rect(3, 4, 18, 3) + rect(3, 11, 18, 3) + rect(3, 18, 18, 3), "", "Menu / three rows"),
  close: glyph(p("M5 2 12 9 19 2 22 5 15 12 22 19 19 22 12 15 5 22 2 19 9 12 2 5Z"), "", "Close"),
  notifications: glyph(p("M5 17V9Q5 3 12 3Q19 3 19 9V17L22 20H2ZM9 22H15"), p("M12 1V3"), "Notifications / a bell"),
};

const source = readFileSync(new URL("../../packages/types/src/constants/resource-ids.ts", import.meta.url), "utf8");
const resourceIds = [...source.matchAll(/^\s*(\w+)\s*=\s*(\d+),/gm)].map(([, key, id]) => ({ key, id: Number(id) }));
const relicBase = {
  Stamina: "stamina",
  Damage: "attack",
  DamageReduction: "defend",
  Exploration: "explore",
  ExplorationReward: "chest",
  StructureDamageReduction: "realm",
  Production: "produce",
  LaborProduction: "labor",
  TroopProduction: "knight",
};
const words = (key) =>
  key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/T([23])/g, " tier $1")
    .replace(/Relic([12])/g, "relic $1");
const tierPips = (tier) => Array.from({ length: tier }, (_, i) => rect(5 + i * 5, 21, 3, 2)).join("");
const shrink = (body) => `<g transform="translate(2 0) scale(.84)">${body}</g>`;

export const catalog = resourceIds.map(({ key, id }) => {
  let name = key === "SAT" ? "sat" : key[0].toLowerCase() + key.slice(1);
  let tier = Number(key.match(/T([23])$/)?.[1] ?? 1);
  const relic = key.match(/(.+)Relic([12])/);
  if (relic) name = relicBase[relic[1]];
  else name = name.replace(/T[23]$/, "");
  const shape = shapes[name];
  if (!shape) throw new Error(`Draw resource ${key}`);
  const isTroop = /^(Knight|Crossbowman|Paladin)/.test(key);
  let { body, detail, reading } = shape;
  if (isTroop) {
    body = shrink(body) + tierPips(tier);
    detail = shrink(detail);
    reading += `, ${tier} rank ${tier === 1 ? "bar" : "bars"}`;
  }
  if (relic) {
    body =
      `<g transform="translate(4 2) scale(.65)">${body}</g>` +
      p("M3 3V20H21V3M3 20 6 23M21 20 18 23") +
      tierPips(Number(relic[2]));
    detail = `<g transform="translate(4 2) scale(.65)">${detail}</g>`;
    reading = `${relic[1].replace(/([a-z])([A-Z])/g, "$1 $2")} relic, ${relic[2]} rank ${relic[2] === "1" ? "bar" : "bars"}`;
  }
  return {
    id: `resource-${id}`,
    resourceId: id,
    key,
    label: words(key),
    family: isTroop ? "Troops · all types and tiers" : relic ? "Relics · all resources" : "Resources · all materials",
    body,
    detail,
    reading,
    ambiguity: [4, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 24, 38].includes(id)
      ? "Exact fantasy material needs a learned association; test against its nearest neighbour."
      : relic
        ? "Effect and rank use a shared relic holder; learn the holder once."
        : "",
  };
});
const groups = {
  Structures: [
    "village",
    "camp",
    "stragglers",
    "shrine",
    "well",
    "ruin",
    "mine",
    "hyperstructure",
    "spire",
    "bitcoinMine",
    "chest",
    "rift",
    "bank",
  ],
  Actions: [
    "move",
    "explore",
    "attack",
    "raid",
    "deploy",
    "transfer",
    "build",
    "produce",
    "claim",
    "upgrade",
    "trade",
    "travel",
  ],
  Statuses: ["stamina", "strength", "timer", "health", "capacity", "defend", "warning"],
  HUD: ["home", "map", "military", "research", "settings", "chat", "leaderboard", "menu", "close", "notifications"],
};
for (const [family, names] of Object.entries(groups)) {
  for (const name of names)
    catalog.push({
      id: name,
      label: words(name[0].toUpperCase() + name.slice(1)),
      family,
      ...shapes[name],
      ambiguity: "",
    });
}
for (let level = 0; level < 4; level++) {
  catalog.push({
    id: `realm-${level}`,
    label: ["Settlement · 0", "City · 1", "Kingdom · 2", "Empire · 3"][level],
    family: "Structures",
    body: shrink(shapes.realm.body) + tierPips(level + 1),
    detail: shrink(shapes.realm.detail),
    reading: `Fortified realm, level ${level} (${level + 1} steps)`,
    ambiguity: "Minimap uses an explicit level numeral; the icon steps are a redundant cue.",
  });
}
for (const [name, body] of Object.entries({
  you: circle(12, 12, 7),
  ally: rect(5, 5, 14, 14),
  enemy: p("M12 3 22 20H2Z"),
})) {
  catalog.push({
    id: `owner-${name}`,
    label: name[0].toUpperCase() + name.slice(1),
    family: "Ownership",
    body,
    detail: "",
    reading: `Ownership: ${name} (${name === "you" ? "circle" : name === "ally" ? "square" : "triangle"})`,
    ambiguity: "A legend is necessary; colour repeats the shape meaning.",
  });
}

export const themes = [
  {
    id: "survey",
    name: "Survey",
    note: "Open, rounded outlines. The quietest HUD; detail remains visible inside small objects.",
    grammar:
      "24-unit grid · 1.8-unit round stroke · no body fill · one outline and up to three internal cuts · neutral ivory, ownership colour only",
    risk: "Thin contours need more attention against busy terrain.",
  },
  {
    id: "banner",
    name: "Banner",
    note: "Solid heraldic silhouettes. The strongest presence on dark panels and crowded maps.",
    grammar:
      "24-unit grid · solid body · 1.8-unit negative cuts · round joins · keep the identifying silhouette, remove shading · neutral ivory, ownership colour only",
    risk: "Small gaps can close; compare mineral pairs at 16 px.",
  },
  {
    id: "signal",
    name: "Signal",
    note: "Stepped, one-bit glyphs. A deliberate map-first direction with fixed pixel rhythm.",
    grammar:
      "16-cell grid · filled cells, no antialiasing inside the master · stepped contour · one-bit cutouts · neutral ivory, ownership colour only",
    risk: "Most abstract at 16 px; relic effects and rare materials need learning.",
  },
];
