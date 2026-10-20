import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "../..");
/** The copy of a missing input written as an error: "Please select an amount…" shown red on open (QA run 1, #15). */
const PROMPT_AS_ERROR = /Please (select|enter|choose|pick)\b/;

const sources = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "node_modules" ? [] : sources(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });

describe("a form's missing input", () => {
  it('is said by its closed button ("Choose an amount"), never as an error before any action', () => {
    const offenders = sources(SRC).flatMap((path) =>
      readFileSync(path, "utf8")
        .split("\n")
        .flatMap((line, index) => (PROMPT_AS_ERROR.test(line) ? [`${relative(SRC, path)}:${index + 1}`] : [])),
    );
    expect(offenders).toEqual([]);
  });
});
