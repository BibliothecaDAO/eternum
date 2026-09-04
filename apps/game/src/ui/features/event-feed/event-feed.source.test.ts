// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/** One event feed. Nothing renders a toast library; every notice goes through the feed's `toast` API. */
const SOURCE_ROOT = resolve(process.cwd(), "src");

const isSourceFile = (name: string) =>
  (name.endsWith(".ts") || name.endsWith(".tsx")) && !name.endsWith(".test.ts") && !name.endsWith(".test.tsx");

const walk = (directory: string): string[] =>
  readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return name === "node_modules" ? [] : walk(path);
    return isSourceFile(name) ? [path] : [];
  });

describe("event feed discipline", () => {
  it("no client file imports the toast library", () => {
    const importers = walk(SOURCE_ROOT)
      .filter((path) => /from ["']sonner["']/.test(readFileSync(path, "utf8")))
      .map((path) => relative(SOURCE_ROOT, path));
    expect(importers).toEqual([]);
  });

  it("only the feed's notify module writes notices", () => {
    const writers = walk(SOURCE_ROOT)
      .filter((path) => /useEventFeedStore\.getState\(\)\.(push|dismiss)/.test(readFileSync(path, "utf8")))
      .map((path) => relative(SOURCE_ROOT, path));
    expect(writers).toEqual(["ui/features/event-feed/notify.ts"]);
  });
});
