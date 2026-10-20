import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "../../..");
// A failure handler: a catch block, a promise's catch, or an order's refused handler.
const HANDLER = /catch\s*\(|\.catch\(|refused:/;
const LINES_BEFORE = 8;

const sources = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "node_modules" ? [] : sources(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });

describe("failure notices", () => {
  it("name their reason through toast.failed: no failure handler says toast.error, which can hide it", () => {
    const offenders = sources(SRC).flatMap((path) => {
      const lines = readFileSync(path, "utf8").split("\n");
      return lines.flatMap((line, index) =>
        line.includes("toast.error(") &&
        HANDLER.test(lines.slice(Math.max(0, index - LINES_BEFORE), index + 1).join("\n"))
          ? [`${relative(SRC, path)}:${index + 1}`]
          : [],
      );
    });
    expect(offenders).toEqual([]);
  });

  it("log once, in toast.failed: no failure handler logs beside it, which would also log a refusal as an error", () => {
    const offenders = sources(SRC).flatMap((path) => {
      const lines = readFileSync(path, "utf8").split("\n");
      return lines.flatMap((line, index) =>
        line.includes("console.error(") &&
        lines
          .slice(index, index + LINES_BEFORE)
          .join("\n")
          .includes("toast.failed(")
          ? [`${relative(SRC, path)}:${index + 1}`]
          : [],
      );
    });
    expect(offenders).toEqual([]);
  });
});
