#!/usr/bin/env node
// A package's `test` script runs its tests once and exits. Agents and CI run `pnpm test` unattended, often under a
// shared lock; a `test` that watches never exits and holds everything waiting behind it. Watching is `test:watch`.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

/**
 * Each command of a script, split at `&&`, `||`, `;`, `|` and `&`, as its words. A narrow grammar: enough for the
 * scripts packages write, not a shell.
 */
const commandsOf = (script) =>
  script
    .split(/&&|\|\||[;|&]/)
    .map((command) => command.replace(/[()]/g, " ").trim().split(/\s+/).filter(Boolean))
    .filter((words) => words.length > 0);

/**
 * Whether one command starts vitest in watch mode. Vitest watches unless its own command says `run` (or `list`) right
 * after it, or carries `--run`: `bench` and `related` watch too, and a flag in one command never covers another.
 */
const watches = (words) => {
  const at = words.findIndex((word) => word === "vitest" || word.endsWith("/vitest"));
  if (at === -1) return false;
  const rest = words.slice(at + 1);
  return !["run", "list"].includes(rest[0]) && !rest.includes("--run");
};

/** Every manifest whose `test` script watches instead of running once. */
export function findWatchingTestScripts(manifests) {
  return manifests.flatMap(({ path, text }) => {
    const script = JSON.parse(text).scripts?.test;
    return typeof script === "string" && commandsOf(script).some(watches) ? [{ path, script }] : [];
  });
}

const committedManifests = () =>
  execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
    .split("\0")
    .filter((path) => /(^|\/)package\.json$/.test(path) && !path.includes("node_modules/"))
    .map((path) => ({ path, text: readFileSync(path, "utf8") }));

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const findings = findWatchingTestScripts(committedManifests());
  for (const { path, script } of findings) {
    console.error(`${path}: "test": "${script}" watches and never exits; run once ("vitest run"), watch in test:watch`);
  }
  if (findings.length > 0) process.exit(1);
  console.log("every package's test script runs once");
}
