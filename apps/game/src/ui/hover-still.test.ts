import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Tailwind classes that grow or shift an element while the pointer is over it. */
const HOVER_MOVES = /\b(?:group-)?hover:(?:-?translate-[xy]-|scale-)\S*/g;

const sources = (directory: string): string[] =>
  readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });

describe("hover", () => {
  it("never grows or shifts an element, so nothing in the HUD moves under the pointer", () => {
    const moving = sources(join(__dirname))
      .flatMap((path) => [...readFileSync(path, "utf8").matchAll(HOVER_MOVES)].map((match) => `${path}: ${match[0]}`))
      .toSorted();
    expect(moving).toEqual([]);
  });
});
