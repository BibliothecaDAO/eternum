import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "../../..");
// A failure handler: a catch block, a promise's catch, or an order's refused handler.
const HANDLER = /catch\s*\(|\.catch\(|refused:/;
const LINES_BEFORE = 8;

// An action sent: a system call, the game client's actions, a building sent to its plot, a submit or perform wrapper,
// or a system call by its own name (create_order, apply_relic).
const SENDS =
  /systemCalls|requireActiveGameClient\(\)|(?<![.\w])actions\.\w+\(|sendBuilding\(|\bawait\s+(?:submit|perform)\w*\(|\bawait\s+[a-z]+(?:_[a-z0-9]+)+\(|\.[a-z]+(?:_[a-z0-9]+)+\(\{/;
const PROMISE_CHAIN_LINES = 15;

const indentOf = (line: string): string => /^\s*/.exec(line)![0];

/** The lines (1-based) where a catch logs the failure of an action its try, or its promise chain, sent. */
const actionCatchLogs = (lines: string[]): number[] =>
  lines.flatMap((line, index) => {
    const caught = /^(\s*)\}\s*catch\b/.exec(line);
    if (caught) {
      const indent = caught[1];
      const tryAt = lines.findLastIndex(
        (other, at) => at < index && indentOf(other) === indent && /\btry\s*\{\s*$/.test(other),
      );
      const closeAt = lines.findIndex((other, at) => at > index && other.startsWith(`${indent}}`));
      const body = lines.slice(index, closeAt === -1 ? undefined : closeAt).join("\n");
      return tryAt !== -1 && SENDS.test(lines.slice(tryAt, index).join("\n")) && body.includes("console.error(")
        ? [index + 1]
        : [];
    }
    return line.includes(".catch(") &&
      lines
        .slice(index, index + 3)
        .join("\n")
        .includes("console.error(") &&
      SENDS.test(lines.slice(Math.max(0, index - PROMISE_CHAIN_LINES), index + 1).join("\n"))
      ? [index + 1]
      : [];
  });

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

  it("read an action's failure through actionFailure or toast.failed: no handler logs it, which would log a refusal", () => {
    const offenders = sources(SRC).flatMap((path) =>
      actionCatchLogs(readFileSync(path, "utf8").split("\n")).map((line) => `${relative(SRC, path)}:${line}`),
    );
    expect(offenders).toEqual([]);
  });
});
