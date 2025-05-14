// src/contexts/generate_persona.ts

// --- Interfaces ---
interface CoreMotivation {
  motivation: string;
  priority: "High" | "Medium" | "Low";
}

interface BehavioralTendencies {
  risk_appetite: "High" | "Medium" | "Low";
  aggression_level: "Hyper-Aggressive" | "Aggressive" | "Moderate" | "Passive" | "Defensive";
  cooperation_inclination: "Highly Cooperative" | "Cooperative" | "Neutral" | "Distrustful" | "Highly Distrustful";
  preferred_engagement_style:
    | "Direct Assault"
    | "Ambush"
    | "Skirmish"
    | "Siege"
    | "Guerilla Tactics"
    | "Economic Warfare"
    | "Diplomatic Pressure"
    | "Avoidance";
  resource_priority: string[];
  deception_inclination: "Frequently" | "Sometimes" | "Rarely" | "Never";
}

interface CommunicationStyle {
  verbosity: "Verbose" | "Moderate" | "Terse" | "Silent";
  formality: "Formal" | "Neutral" | "Informal" | "Crude";
  honesty_level:
    | "Always Honest"
    | "Usually Honest"
    | "Situationally Honest"
    | "Sometimes Dishonest"
    | "Often Dishonest"
    | "Pathological Liar";
}

interface InitialSkillBias {
  combat_focus: "Very High" | "High" | "Medium" | "Low" | "Very Low";
  economic_focus: "Very High" | "High" | "Medium" | "Low" | "Very Low";
  diplomacy_focus: "Very High" | "High" | "Medium" | "Low" | "Very Low";
}

interface FactionAffinityTendencies {
  prefers_strong_allies: boolean;
  suspicious_of_lone_players: boolean;
  attracted_to_wealthy_factions: boolean;
}

interface Persona {
  persona_id: string;
  name: string;
  archetype: string;
  core_motivations: CoreMotivation[];
  behavioral_tendencies: BehavioralTendencies;
  communication_style: CommunicationStyle;
  initial_skill_bias: InitialSkillBias;
  faction_affinity_tendencies: FactionAffinityTendencies;
  keywords_for_dialogue_generation: string[];
}

// --- Seeded PRNG (Linear Congruential Generator) ---
class SeededRandom {
  private seed: number;
  private a = 1664525;
  private c = 1013904223;
  private m = 2 ** 32;

  constructor(seed: number) {
    this.seed = seed;
  }

  // Generates a pseudo-random number between 0 (inclusive) and 1 (exclusive)
  next(): number {
    this.seed = (this.a * this.seed + this.c) % this.m;
    return this.seed / this.m;
  }

  // Generates a pseudo-random integer between min (inclusive) and max (exclusive)
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min)) + min;
  }

  // Selects a random element from an array
  select<T>(arr: T[]): T {
    if (arr.length === 0) {
      throw new Error("Cannot select from an empty array.");
    }
    return arr[this.nextInt(0, arr.length)];
  }

  // Selects a random subset of elements from an array
  selectSubset<T>(arr: T[], minCount: number = 1, maxCount?: number): T[] {
    if (arr.length === 0) return [];
    const count = this.nextInt(minCount, maxCount !== undefined ? Math.min(maxCount, arr.length) + 1 : arr.length + 1);
    const shuffled = [...arr].sort(() => this.next() - 0.5); // Simple shuffle
    return shuffled.slice(0, count);
  }

  // Generates a random boolean
  nextBoolean(trueProbability: number = 0.5): boolean {
    return this.next() < trueProbability;
  }
}

// --- Predefined Value Sets ---
const ARCHETYPES = [
  "Aggressive Raider",
  "Cautious Defender",
  "Economic Powerhouse",
  "Diplomatic Mastermind",
  "Opportunistic Scavenger",
  "Zealous Crusader",
  "Mystic Seeker",
];
const MOTIVATIONS = [
  "Resource Plunder",
  "Combat Dominance",
  "Survival",
  "Territory Expansion",
  "Technological Supremacy",
  "Trade Dominance",
  "Cultural Influence",
  "Knowledge Seeking",
  "Revenge",
];
const PRIORITIES: Array<"High" | "Medium" | "Low"> = ["High", "Medium", "Low"];
const RISK_APPETITES: BehavioralTendencies["risk_appetite"][] = ["High", "Medium", "Low"];
const AGGRESSION_LEVELS: BehavioralTendencies["aggression_level"][] = [
  "Hyper-Aggressive",
  "Aggressive",
  "Moderate",
  "Passive",
  "Defensive",
];
const COOPERATION_INCLINATIONS: BehavioralTendencies["cooperation_inclination"][] = [
  "Highly Cooperative",
  "Cooperative",
  "Neutral",
  "Distrustful",
  "Highly Distrustful",
];
const ENGAGEMENT_STYLES: BehavioralTendencies["preferred_engagement_style"][] = [
  "Direct Assault",
  "Ambush",
  "Skirmish",
  "Siege",
  "Guerilla Tactics",
  "Economic Warfare",
  "Diplomatic Pressure",
  "Avoidance",
];
const RESOURCES = [
  "gold",
  "food",
  "wood",
  "stone",
  "mana",
  "army_units",
  "technology_points",
  "influence",
  "rare_materials",
  "population",
];
const DECEPTION_INCLINATIONS: BehavioralTendencies["deception_inclination"][] = [
  "Frequently",
  "Sometimes",
  "Rarely",
  "Never",
];

const VERBOSITY_LEVELS: CommunicationStyle["verbosity"][] = ["Verbose", "Moderate", "Terse", "Silent"];
const FORMALITY_LEVELS: CommunicationStyle["formality"][] = ["Formal", "Neutral", "Informal", "Crude"];
const HONESTY_LEVELS: CommunicationStyle["honesty_level"][] = [
  "Always Honest",
  "Usually Honest",
  "Situationally Honest",
  "Sometimes Dishonest",
  "Often Dishonest",
  "Pathological Liar",
];

const FOCUS_LEVELS: InitialSkillBias["combat_focus"][] = ["Very High", "High", "Medium", "Low", "Very Low"];

const KEYWORDS = [
  // Fantasy / action
  "smash",
  "take",
  "mine",
  "weakling",
  "fight",
  "more loot",
  "build",
  "defend",
  "trade",
  "ally",
  "peace",
  "war",
  "destroy",
  "gold",
  "power",
  "honor",
  "strategy",
  "wisdom",
  "curse",
  "magic",
  "faith",
  "knowledge",
  "progress",
  "wealth",
  "fear",
  "strength",
  "glory",
  "conquer",
  "protect",
  "grow",
  "expand",
  // Slang & gamer tags
  "yo",
  "bruh",
  "fam",
  "lit",
  "dope",
  "yeet",
  "sus",
  "bet",
  "no cap",
  "pog",
  "poggers",
  "gg",
  "ez",
  "rekt",
  "lmao",
  "lol",
  "omg",
  "grind",
  "loot",
  "gear",
  "buff",
  "nerf",
  "strats",
  "clutch",
  "lag",
  "afk",
  "irl",
  "pwn",
  "spam",
  "hype",
  "chill",
  "flex",
  "grief",
  // Crypto / tech slang
  "hodl",
  "to the moon",
  "gas",
  "wagmi",
  "fomo",
  "rug",
  "ape",
  "mint",
  "block",
  "chain",
  "rugged",
  "brah",
  "mog",
  "bro",
  "dude",
  "guy",
  "buddy",
  "pal",
  "chad",
  "aura",
  "fr fr",
];

// --- Name Generation Data and Functions (adapted from src/old/character-gen.ts) ---

// Interface for the numeric traits expected by the original generateName
interface NumericTraits {
  aggression: number;
  agreeability: number;
  openness: number;
  conscientiousness: number;
  extraversion: number;
  neuroticism: number;
  empathy: number;
  confidence: number;
  adaptability: number;
  impulsivity: number;
  evil: number;
  good: number;
  chivalry: number;
  vagabond: number;
}

// Helper to generate a single numeric trait value (1-10)
function generateNumericTraitValue(random: SeededRandom): number {
  return random.nextInt(1, 11); // Generates 1-10
}

// ---------------- CYBERPUNK NAME COMPONENTS ----------------
const LIGHT_PREFIXES = [
  "Neon",
  "Crypto",
  "Quantum",
  "Nova",
  "Genesis",
  "Meta",
  "Satoshi",
  "Pulse",
  "Prism",
  "Hex",
  "Byte",
  "Pixel",
  "Solar",
  "Lumina",
  "Glint",
];

const DARK_PREFIXES = [
  "Shadow",
  "Dark",
  "Ghost",
  "Phantom",
  "Zero",
  "Null",
  "Abyss",
  "Obsidian",
  "Night",
  "Cipher",
  "Glitch",
  "Virus",
  "Storm",
  "Chaos",
  "Grim",
];

const CYBER_SUFFIXES = [
  "Runner",
  "Punk",
  "Hacker",
  "Nomad",
  "Drifter",
  "Cipher",
  "Miner",
  "Validator",
  "Operator",
  "Daemon",
  "Phreak",
  "Rider",
  "Synth",
  "Ghost",
  "Pilot",
  "Proxy",
  "Glitch",
  "Override",
  "Flux",
  "Node",
];

const CRYPTO_TERMS = [
  "Chain",
  "Block",
  "Hash",
  "Token",
  "Ledger",
  "DeFi",
  "DAO",
  "NFT",
  "DEX",
  "Gas",
  "Stake",
  "Yield",
  "Liquidity",
  "Sol",
  "Eth",
  "Btc",
  "STARK",
  "vitaliksMaid",
  "Dot",
  "Link",
  "Ada",
  "Mog",
  "Bro",
  "Dude",
  "Guy",
  "Buddy",
  "Pal",
  "nakamoto",
  "layer",
];

// Update generateName to create cyberpunk/gamer-tag/crypto handles
function generateName(traits: NumericTraits, random: SeededRandom): string {
  const lightScore =
    (traits.agreeability +
      traits.empathy +
      traits.conscientiousness +
      (10 - traits.aggression) + // Invert aggression for light score
      (10 - traits.neuroticism)) / // Invert neuroticism for light score
    5;

  const prefixPool =
    lightScore > 6 ? LIGHT_PREFIXES : lightScore < 4 ? DARK_PREFIXES : [...LIGHT_PREFIXES, ...DARK_PREFIXES];
  const prefix = random.select(prefixPool);
  const suffix = random.select(CYBER_SUFFIXES);

  // Helper to generate a hex snippet (2–4 hex chars)
  const hexSnippet = () => random.nextInt(0x100, 0xffff).toString(16).toUpperCase();

  // Choose a pattern id 0-5
  const patternId = random.nextInt(0, 6);
  switch (patternId) {
    case 0:
      // PrefixSuffixNumber e.g., NeonRunner2077
      return `${prefix}${suffix}${random.nextInt(10, 100)}`;
    case 1:
      // Prefix_Suffix### e.g., Hash_Nomad42
      return `${prefix}_${suffix}${random.nextInt(1, 1000)}`;
    case 2:
      // 0xHEX+Suffix e.g., 0xA9F3Validator
      return `0x${hexSnippet()}${suffix}`;
    case 3:
      // Prefix+CryptoTerm+## e.g., QuantumChain88
      return `${prefix}${random.select(CRYPTO_TERMS)}${random.nextInt(10, 100)}`;
    case 4:
      // PrefixSuffix (no number) e.g., GhostPilot
      return `${prefix}${suffix}`;
    case 5:
    default:
      // Prefix-Suffix-Hex e.g., Dark-Cipher-7E1A
      return `${prefix}-${suffix}-${hexSnippet()}`;
  }
}

// --- Generation Function ---
function generatePersona(seed: number): Persona {
  const random = new SeededRandom(seed);

  // Generate numeric traits for name generation
  const numericTraits: NumericTraits = {
    aggression: generateNumericTraitValue(random),
    agreeability: generateNumericTraitValue(random),
    openness: generateNumericTraitValue(random),
    conscientiousness: generateNumericTraitValue(random),
    extraversion: generateNumericTraitValue(random),
    neuroticism: generateNumericTraitValue(random),
    empathy: generateNumericTraitValue(random),
    confidence: generateNumericTraitValue(random),
    adaptability: generateNumericTraitValue(random),
    impulsivity: generateNumericTraitValue(random),
    evil: generateNumericTraitValue(random),
    good: generateNumericTraitValue(random),
    chivalry: generateNumericTraitValue(random),
    vagabond: generateNumericTraitValue(random),
  };

  const personaName = generateName(numericTraits, random);
  const persona_id = `persona_${seed}_${random.nextInt(1000, 9999)}`;
  const archetype = random.select(ARCHETYPES);

  const numCoreMotivations = random.nextInt(2, 5); // 2 to 4 motivations
  const core_motivations: CoreMotivation[] = [];
  const availableMotivations = [...MOTIVATIONS];
  for (let i = 0; i < numCoreMotivations; i++) {
    if (availableMotivations.length === 0) break;
    const motivationIndex = random.nextInt(0, availableMotivations.length);
    const motivation = availableMotivations.splice(motivationIndex, 1)[0];
    core_motivations.push({
      motivation,
      priority: random.select(PRIORITIES),
    });
  }

  const behavioral_tendencies: BehavioralTendencies = {
    risk_appetite: random.select(RISK_APPETITES),
    aggression_level: random.select(AGGRESSION_LEVELS),
    cooperation_inclination: random.select(COOPERATION_INCLINATIONS),
    preferred_engagement_style: random.select(ENGAGEMENT_STYLES),
    resource_priority: random.selectSubset(RESOURCES, 2, 5), // 2 to 5 priority resources
    deception_inclination: random.select(DECEPTION_INCLINATIONS),
  };

  const communication_style: CommunicationStyle = {
    verbosity: random.select(VERBOSITY_LEVELS),
    formality: random.select(FORMALITY_LEVELS),
    honesty_level: random.select(HONESTY_LEVELS),
  };

  const initial_skill_bias: InitialSkillBias = {
    combat_focus: random.select(FOCUS_LEVELS),
    economic_focus: random.select(FOCUS_LEVELS),
    diplomacy_focus: random.select(FOCUS_LEVELS),
  };

  const faction_affinity_tendencies: FactionAffinityTendencies = {
    prefers_strong_allies: random.nextBoolean(),
    suspicious_of_lone_players: random.nextBoolean(),
    attracted_to_wealthy_factions: random.nextBoolean(0.66), // Slightly more likely to be attracted to wealth
  };

  const keywords_for_dialogue_generation = random.selectSubset(KEYWORDS, 5, 10); // 5 to 10 keywords

  return {
    persona_id,
    name: personaName,
    archetype,
    core_motivations,
    behavioral_tendencies,
    communication_style,
    initial_skill_bias,
    faction_affinity_tendencies,
    keywords_for_dialogue_generation,
  };
}

// Export for potential use in other modules (optional)
export { generateName, generatePersona, SeededRandom };
export type {
  BehavioralTendencies,
  CommunicationStyle,
  CoreMotivation,
  FactionAffinityTendencies,
  InitialSkillBias,
  NumericTraits,
  Persona,
};
