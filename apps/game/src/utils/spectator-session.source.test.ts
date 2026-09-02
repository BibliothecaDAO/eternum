// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Spectator intent has one reader. Every play-route resolver latches it through `resolveSpectateIntent`; nothing
 * else parses the `spectate` query, so the session fact and the route can never disagree.
 */
const SOURCE_ROOT = resolve(process.cwd(), "src");
const THE_ONE_READER = "utils/spectator-session.ts";
const SPECTATE_QUERY_READ = /\.get\(\s*["']spectate["']\s*\)/;

const isSourceFile = (name: string) =>
  (name.endsWith(".ts") || name.endsWith(".tsx")) && !name.endsWith(".test.ts") && !name.endsWith(".test.tsx");

const walk = (directory: string): string[] =>
  readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return name === "node_modules" ? [] : walk(path);
    return isSourceFile(name) ? [path] : [];
  });

describe("spectator session discipline", () => {
  it("only spectator-session.ts reads the spectate query", () => {
    const readers = walk(SOURCE_ROOT)
      .filter((path) => SPECTATE_QUERY_READ.test(readFileSync(path, "utf8")))
      .map((path) => relative(SOURCE_ROOT, path));
    expect(readers).toEqual([THE_ONE_READER]);
  });

  it("the parsed play route carries no spectate flag of its own", () => {
    const playRoute = readFileSync(resolve(SOURCE_ROOT, "play/navigation/play-route.ts"), "utf8");
    const descriptor = playRoute.slice(
      playRoute.indexOf("export interface PlayRouteDescriptor"),
      playRoute.indexOf("}", playRoute.indexOf("export interface PlayRouteDescriptor")),
    );
    expect(descriptor).not.toContain("spectate");
  });
});
