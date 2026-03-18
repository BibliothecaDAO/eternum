import type { FactoryGameMode } from "./types";

const ETERNUM_WORDS = [
  "myth",
  "rune",
  "lore",
  "gale",
  "wyrm",
  "void",
  "onyx",
  "moss",
  "fate",
  "dusk",
  "ember",
  "cinder",
  "thorn",
  "shade",
  "bloom",
  "drift",
  "glint",
  "crest",
  "sable",
  "grove",
  "relic",
  "spire",
  "echo",
  "flare",
  "wisp",
  "storm",
  "quill",
  "titan",
  "vigil",
  "stone",
  "briar",
  "mist",
  "bastion",
  "gloom",
  "crown",
  "haven",
];
const BLITZ_WORDS = [
  "flux",
  "jolt",
  "zoom",
  "vibe",
  "riff",
  "fizz",
  "dash",
  "glow",
  "zest",
  "nova",
  "bolt",
  "snap",
  "whiz",
  "kick",
  "ping",
  "spark",
  "crisp",
  "rush",
  "blink",
  "blip",
  "pop",
  "swish",
  "pulse",
  "quick",
  "clash",
  "burst",
  "skid",
  "stomp",
  "flash",
  "twist",
  "lilt",
  "chirp",
  "froth",
  "thrum",
  "boost",
  "zip",
];

const getWordSetForMode = (mode: FactoryGameMode) => (mode === "eternum" ? ETERNUM_WORDS : BLITZ_WORDS);

const pickRandomWord = (words: string[], random: () => number) =>
  words[Math.floor(random() * words.length)] ?? words[0];

const clampGameNumber = (value: number) => Math.min(999, Math.max(1, value));

const buildRandomGameNumber = (sequenceNumber: number, random: () => number) => {
  const randomizedValue = Math.floor(random() * 999) + 1;

  return Number.isFinite(randomizedValue) ? randomizedValue : clampGameNumber(sequenceNumber);
};

export const buildFandomizedGameName = (
  mode: FactoryGameMode,
  sequenceNumber: number,
  random: () => number = Math.random,
) => {
  const words = getWordSetForMode(mode);
  const prefix = mode === "eternum" ? "etrn" : "bltz";
  const word = pickRandomWord(words, random);
  const suffix = buildRandomGameNumber(sequenceNumber, random);

  return `${prefix}-${word}-${suffix}`;
};
