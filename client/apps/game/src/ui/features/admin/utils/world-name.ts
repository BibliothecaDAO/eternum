/**
 * Four-letter word dictionary for world name generation.
 * Curated for memorability, uniqueness, and thematic fit.
 */
const FOUR_LETTER_WORDS = [
  // Nature & Elements
  "fire",
  "wave",
  "gale",
  "mist",
  "dawn",
  "dusk",
  "rain",
  "snow",
  "sand",
  "clay",
  "iron",
  "gold",
  "jade",
  "ruby",
  "opal",
  // Actions & States
  "rush",
  "flow",
  "push",
  "pull",
  "burn",
  "heal",
  "grow",
  "fade",
  "rise",
  "fall",
  "soar",
  "dive",
  // Objects & Places
  "gate",
  "keep",
  "tomb",
  "fort",
  "maze",
  "peak",
  "vale",
  "cave",
  "rift",
  "void",
  // Abstract & Qualities
  "bold",
  "wild",
  "vast",
  "pure",
  "dark",
  "cold",
  "warm",
  "soft",
  "hard",
  "deep",
  "high",
  "true",
  // Mystical & Game-themed
  "myth",
  "epic",
  "sage",
  "lore",
  "fate",
  "doom",
  "fury",
  "zeal",
  "flux",
  "echo",
  "nova",
  "apex",
] as const;

/**
 * Generates a world name with format: test-xxxx-xxxx-##
 * Example output: "test-fire-gate-42", "test-dark-void-17"
 *
 * @returns A world name with prefix, two 4-letter words, and 2-digit number
 */
export const generateWorldName = (): string => {
  const getRandomWord = (): string => {
    const randomIndex = Math.floor(Math.random() * FOUR_LETTER_WORDS.length);
    return FOUR_LETTER_WORDS[randomIndex];
  };

  // Generate 2 unique words to avoid duplicates like "fire-fire"
  const words = new Set<string>();
  while (words.size < 2) {
    words.add(getRandomWord());
  }

  // Generate random 2-digit number (10-99)
  const randomNumber = Math.floor(Math.random() * 90) + 10;

  return `test-${Array.from(words).join("-")}-${randomNumber}`;
};

/**
 * Validate a world name format
 */
export const isValidWorldName = (name: string): boolean => {
  // Must be alphanumeric with hyphens, 3-31 chars (felt252 limit)
  const pattern = /^[a-z0-9][a-z0-9-]{1,29}[a-z0-9]$/;
  return pattern.test(name);
};

/**
 * Sanitize a world name to be valid
 */
export const sanitizeWorldName = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 31);
};
