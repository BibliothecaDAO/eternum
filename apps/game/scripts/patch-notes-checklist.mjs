#!/usr/bin/env node
// The patch notes' checklist: everything that changed since a release, read from the code, so the release's note can
// map each item to a line or a reason it is left out (content/patch-notes/AGENTS.md). Run from the repository root:
//
//   node apps/game/scripts/patch-notes-checklist.mjs --since <the live release's commit> > checklist.md
//
// A mode whose live games ran a preset other than the generated one (Blitz's 60-minute profile at 638fd7fb410) is
// compared with that preset instead: `--base-preset blitz=<its composed JSON>`.
//
// Four sources, each item numbered: each mode's composed preset (config/generated/<mode>.madara.json), setting by
// setting, old → new; the world contracts' rule constants and each preset's mode rules; the client's feature map; and
// every commit's subject, grouped by the area its files touch.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import process from "node:process";
import { pathToFileURL } from "node:url";

const CONTRACTS_NOW = "contracts/l3/world-native/src";
/** Where the contracts lived before the native rewrite, read when the release predates it. */
const CONTRACTS_BEFORE = ["contracts/l3/world-native/src", "contracts/l3/game"];
const FEATURE_MAP = "apps/game/FEATURE-MAP.md";
/** A commit's area: the first rule one of its files matches, in this order. */
const AREAS = [
  ["Contracts", /^contracts\//],
  ["Presets", /^config\//],
  ["App (outside a match)", /^apps\/game\/src\/shell\//],
  ["Client in a match", /^apps\/game\/src\/(ui|three|hooks|dojo|services|utils|config)\//],
  ["Client art and assets", /^apps\/game\/(public|asset-sources)\//],
  ["Game logic and sync", /^packages\//],
  [
    "Herald and services",
    /^apps\/(herald|indexer|guardian|launch-service|value-relay|status|status-monitor|agent-runner|amm-indexer)\//,
  ],
  ["Docs site", /^apps\/game-docs\//],
  ["Infrastructure and deploys", /^(deploy|\.github)\//],
  ["Client tooling, labs and tests", /^apps\/game\//],
];

const git = (...args) =>
  execFileSync("git", args, { encoding: "utf8", maxBuffer: 1 << 28, stdio: ["ignore", "pipe", "ignore"] });
const gitOr = (fallback, ...args) => {
  try {
    return git(...args);
  } catch {
    return fallback;
  }
};

/** Every leaf of a JSON value by its path: `troop.stamina.staminaInitial`, `startingResources[1].amount`. */
function flatten(value, path = "") {
  if (Array.isArray(value)) return value.flatMap((item, index) => flatten(item, `${path}[${index}]`));
  if (value !== null && typeof value === "object")
    return Object.entries(value).flatMap(([key, item]) => flatten(item, path ? `${path}.${key}` : key));
  return [[path, value]];
}

/** A setting: its path up to the first index or numeric key (`buildings.simpleBuildingCost`, `troop.limit.x`). */
const settingOf = (path) => path.split(/\[|\.(?=\d)/)[0];

/** Deployment wiring, not balance: addresses, keys and hashes a player never meets. */
const isWiring = (path) => /address|class_hash|controller|fee_recipient|rpc|vrf|^agent\.|^setup\./i.test(path);

/** The settings that differ between two composed presets, each with its leaves old → new. */
export function diffPresets(before, after) {
  const old = new Map(flatten(before));
  const now = new Map(flatten(after));
  const settings = new Map();
  for (const path of new Set([...old.keys(), ...now.keys()])) {
    if (isWiring(path) || String(old.get(path)) === String(now.get(path))) continue;
    const setting = settingOf(path);
    if (!settings.has(setting)) settings.set(setting, []);
    settings.get(setting).push(`${path}: ${show(old.get(path))} → ${show(now.get(path))}`);
  }
  return [...settings].sort(([left], [right]) => left.localeCompare(right));
}

const show = (value) => (value === undefined ? "(none)" : JSON.stringify(value));

/** Each `pub const NAME: T = value;` of a tree's Cairo files, by name. */
function constantsOf(sources) {
  const constants = new Map();
  for (const [file, source] of sources)
    for (const match of source.matchAll(/^\s*pub const ([A-Z0-9_]+)\s*:[^=]+=\s*([^;]+);/gm))
      constants.set(match[1], { file, value: brief(match[2].replace(/\s+/g, " ").trim()) });
  return constants;
}

/** A long value (a table of routes) cut to its start: the checklist names it, the file holds it. */
const brief = (value) => (value.length > 80 ? `${value.slice(0, 77)}...` : value);

/** The constants added, changed or removed, each named with its file. */
export function diffConstants(before, after) {
  const lines = [];
  for (const [name, now] of after) {
    const old = before.get(name);
    if (!old) lines.push(`added ${name} = ${now.value} (${now.file})`);
    else if (old.value !== now.value) lines.push(`changed ${name}: ${old.value} → ${now.value} (${now.file})`);
  }
  for (const [name, old] of before) if (!after.has(name)) lines.push(`removed ${name} = ${old.value} (${old.file})`);
  return lines.sort();
}

/** The feature map's features: each table row's first cell and each rule in bold, under its section. */
export function featuresOf(markdown) {
  const features = [];
  let section = "";
  for (const line of markdown.split("\n")) {
    if (/^#{2,3} /.test(line)) section = line.replace(/^#+ /, "");
    const row = line.match(/^\| ([^|]+?) +\|/);
    if (row && !/^-+$/.test(row[1]) && row[1] !== "Feature") features.push(`${section}: ${row[1]}`);
    const rule = line.match(/^- \*\*(.+?)\*\*/);
    if (rule) features.push(`${section}: ${rule[1]}`);
  }
  return features;
}

/** A commit's area, from the files it touches. */
export const areaOf = (files) =>
  AREAS.find(([, pattern]) => files.some((file) => pattern.test(file)))?.[0] ?? "Repository";

function presetItems(since, basePresets) {
  const modes = git("ls-tree", "--name-only", "HEAD", "config/generated/")
    .split("\n")
    .filter((file) => file.endsWith(".madara.json"));
  return modes.map((file) => {
    const mode = file.split("/").pop().replace(".madara.json", "");
    const before = basePresets.has(mode)
      ? readFileSync(basePresets.get(mode), "utf8")
      : gitOr(null, "show", `${since}:${file}`);
    if (before === null) return { title: `Preset ${mode}`, items: [[`${mode} is new: no preset at ${since}`, []]] };
    const settings = diffPresets(
      JSON.parse(before).configuration,
      JSON.parse(git("show", `HEAD:${file}`)).configuration,
    );
    const base = basePresets.get(mode) ?? `${since}:${file}`;
    return { title: `Preset ${mode} (${base} → HEAD:${file})`, items: settings };
  });
}

function treeSources(ref, roots) {
  for (const root of roots) {
    const files = gitOr("", "ls-tree", "-r", "--name-only", ref, root)
      .split("\n")
      .filter((file) => file.endsWith(".cairo") && !/test/i.test(file));
    if (files.length > 0) return files.map((file) => [file, git("show", `${ref}:${file}`)]);
  }
  return [];
}

function contractItems(since) {
  const lines = diffConstants(
    constantsOf(treeSources(since, CONTRACTS_BEFORE)),
    constantsOf(treeSources("HEAD", [CONTRACTS_NOW])),
  );
  const rules = git("grep", "-h", "-E", "modeRules", "HEAD", "--", "config/source")
    .split("\n")
    .filter(Boolean)
    .map((line) => `mode rules now: ${line.replace(/^HEAD:/, "").trim()}`);
  return { title: "Contract rules", items: [...lines, ...rules].map((line) => [line, []]) };
}

function featureItems(since) {
  const before = new Set(featuresOf(gitOr("", "show", `${since}:${FEATURE_MAP}`)));
  const now = featuresOf(git("show", `HEAD:${FEATURE_MAP}`));
  const added = now.filter((feature) => !before.has(feature)).map((feature) => [`added ${feature}`, []]);
  const removed = [...before].filter((feature) => !now.includes(feature)).map((feature) => [`removed ${feature}`, []]);
  return { title: `Features (${FEATURE_MAP})`, items: [...added, ...removed] };
}

function commitItems(since) {
  const log = git("log", "--no-merges", "--format=@@%h %s", "--name-only", `${since}..HEAD`);
  const areas = new Map();
  for (const block of log.split("@@").filter(Boolean)) {
    const [subject, ...files] = block.trim().split("\n").filter(Boolean);
    const area = areaOf(files);
    if (!areas.has(area)) areas.set(area, []);
    areas.get(area).push(subject);
  }
  const ordered = [...AREAS.map(([area]) => area), "Repository"].filter((area) => areas.has(area));
  return {
    title: "Commits by area",
    items: ordered.map((area) => [`${area}: ${areas.get(area).length} commits`, areas.get(area)]),
  };
}

function render(since, groups) {
  const out = [`# Patch notes checklist since ${since}`, "", `HEAD ${git("rev-parse", "--short", "HEAD").trim()}`, ""];
  let number = 0;
  for (const { title, items } of groups) {
    out.push(`## ${title}`, "");
    for (const [item, details] of items) {
      out.push(`- [ ] **${++number}.** ${item}`);
      for (const detail of details) out.push(`  - ${detail}`);
    }
    out.push("");
  }
  return out.join("\n");
}

function main() {
  const since = process.argv[process.argv.indexOf("--since") + 1];
  if (!process.argv.includes("--since") || !since) throw new Error("usage: patch-notes-checklist.mjs --since <commit>");
  const basePresets = new Map(
    process.argv.flatMap((arg, index) => (process.argv[index - 1] === "--base-preset" ? [arg.split("=")] : [])),
  );
  const groups = [...presetItems(since, basePresets), contractItems(since), featureItems(since), commitItems(since)];
  process.stdout.write(render(since, groups));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
