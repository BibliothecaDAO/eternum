import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Tailwind classes that grow or shift an element while the pointer is over it. */
const HOVER_MOVES = /\b(?:group-)?hover:(?:-?translate-[xy]-|scale-)\S*/g;
/**
 * Tailwind classes that show an element while the pointer is over another: a tooltip drawn in place, inside its
 * panel's stacking and clipping, so the next row or the panel's edge covers it.
 */
const HOVER_SHOWS = /\b(?:group|peer)(?:\/[\w-]+)?-hover:(?:block|flex|inline\S*|grid|table|visible)\b/g;

const sources = (directory: string): string[] =>
  readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });

/** Where the UI's sources use a pattern, as "path: match", in order. */
const matchesIn = (pattern: RegExp) =>
  sources(join(__dirname))
    .flatMap((path) => [...readFileSync(path, "utf8").matchAll(pattern)].map((match) => `${path}: ${match[0]}`))
    .toSorted();

describe("hover", () => {
  it("never grows or shifts an element, so nothing in the HUD moves under the pointer", () => {
    expect(matchesIn(HOVER_MOVES)).toEqual([]);
  });

  it("never shows a tooltip in place: a name goes on the app's one tooltip (data-tip), above every panel", () => {
    expect(matchesIn(HOVER_SHOWS)).toEqual([]);
  });
});
