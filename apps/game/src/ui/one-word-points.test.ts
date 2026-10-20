import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/** A word a player reads, in a string or between tags, that names points by an abbreviation. */
const ABBREVIATED = /(?:["'`>])[^"'`<\n]*\b(?:VP|pts)\b/g;

/** The voice rules state this one, its bad example included (design-system/kit/voice.ts). */
const RULES_FILE = join(__dirname, "design-system/kit/voice.ts");

const sources = (directory: string): string[] =>
  readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return name === "debug" ? [] : sources(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) && path !== RULES_FILE ? [path] : [];
  });

it("names the score one way, points, wherever a player reads it", () => {
  const abbreviated = sources(join(__dirname, ".."))
    .flatMap((path) => [...readFileSync(path, "utf8").matchAll(ABBREVIATED)].map((match) => `${path}: ${match[0]}`))
    .toSorted();
  expect(abbreviated).toEqual([]);
});
