#!/usr/bin/env node
// The patch notes' checklist: everything that changed since a release, read from the code, each item with a stable
// id, so a release's note can prove it missed nothing (content/patch-notes/AGENTS.md). Run from the repository root:
//
//   node apps/game/scripts/patch-notes-checklist.mjs --since <live commit> [--head <ref>]
//     [--base-preset <mode>=<composed JSON>] [--coverage <coverage JSON>] > checklist.md
//
// Five sources: each mode's composed preset (config/generated/<mode>.madara.json) setting by setting, old → new (a
// mode whose live games ran another preset is compared with that one, `--base-preset`); the world contracts' rule
// constants and each preset's mode rules; the client's feature map; the retired change list's entries since the
// release; and every commit since the release, one by one, with the area its files touch.
//
// With `--coverage`, every item must be mapped to a line of the release's note, or left out for a stated reason, and
// every line of the note must be mapped from an item: the run prints the table and fails on any gap.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import process from "node:process";
import { pathToFileURL } from "node:url";

const CONTRACTS_NOW = "contracts/l3/world-native/src";
/** Where the contracts lived before the native rewrite, read when the release predates it. */
const CONTRACTS_BEFORE = ["contracts/l3/world-native/src", "contracts/l3/game"];
const FEATURE_MAP = "apps/game/FEATURE-MAP.md";
/** The per-change list every lane appended to until patch notes replaced it; read at its last revision. */
const CHANGE_LIST = "apps/game/src/ui/features/world/latest-features.ts";
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

/** The retired change list's entries: each object's day, title and description, its strings joined. */
export function changeListOf(source) {
  const strings = (text) => [...text.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((match) => JSON.parse(`"${match[1]}"`));
  return source
    .split(/\{\s*date:/)
    .slice(1)
    .flatMap((block) => {
      const day = block.match(/^\s*"(\d{4}-\d{2}-\d{2})"/)?.[1];
      const title = block.match(/title:\s*((?:"(?:[^"\\]|\\.)*"\s*\+?\s*)+)/)?.[1];
      const description = block.match(/description:\s*((?:"(?:[^"\\]|\\.)*"\s*\+?\s*)+)/)?.[1];
      return day && title
        ? [{ day, title: strings(title).join(""), description: strings(description ?? "").join("") }]
        : [];
    });
}

/** A release note's lines: each named by its section and its name ("Blitz: Guards"), with what it says. */
export function entriesOf(markdown) {
  const entries = [];
  let section = "";
  for (const line of markdown.split("\n")) {
    if (line.startsWith("## ")) section = line.slice(3).trim();
    const item = line.match(/^- \{[a-z0-9-]+\} \*\*([^*]+)\*\*: (.*)$/);
    if (item) entries.push({ name: `${section}: ${item[1]}`, text: item[2] });
    else if (entries.length > 0 && /^ {2}\S/.test(line)) entries.at(-1).text += ` ${line.trim()}`;
  }
  return entries;
}

/** A commit's area, from the files it touches. */
export const areaOf = (files) =>
  AREAS.find(([, pattern]) => files.some((file) => pattern.test(file)))?.[0] ?? "Repository";

/**
 * Each item's verdict from the coverage file: the line it maps to, or why it is left out (by its id, else by the first
 * rule its text matches). A line may only be named by id, so no rule maps a group of items to one line. Unmapped items,
 * lines the note does not have and lines no item maps to are the gaps.
 */
export function checkCoverage(items, coverage, entries) {
  const names = entries.map((entry) => entry.name);
  const known = new Set(names);
  const rules = (coverage.outRules ?? []).map(({ match, reason }) => ({ pattern: new RegExp(match), reason }));
  const rows = items.map((item) => {
    const line = coverage.covered?.[item.id];
    if (line) return { ...item, line, known: known.has(line) };
    const reason =
      coverage.out?.[item.id] ?? rules.find(({ pattern }) => pattern.test(`${item.id} ${item.text}`))?.reason;
    return { ...item, reason };
  });
  const sourced = new Set(rows.flatMap((row) => (row.line ? [row.line] : [])));
  return {
    rows,
    unmapped: rows.filter((row) => !row.line && !row.reason).map((row) => row.id),
    unknownLines: [...new Set(rows.filter((row) => row.line && !row.known).map((row) => row.line))],
    unsourcedLines: names.filter((name) => !sourced.has(name)),
  };
}

function presetItems(since, head, basePresets) {
  const modes = git("ls-tree", "--name-only", head, "config/generated/")
    .split("\n")
    .filter((file) => file.endsWith(".madara.json"));
  return modes.map((file) => {
    const mode = file.split("/").pop().replace(".madara.json", "");
    const before = basePresets.has(mode)
      ? readFileSync(basePresets.get(mode), "utf8")
      : gitOr(null, "show", `${since}:${file}`);
    if (before === null)
      return {
        title: `Preset ${mode}`,
        items: [{ id: `preset:${mode}:new`, text: `${mode} is new: no preset at ${since}` }],
      };
    const settings = diffPresets(
      JSON.parse(before).configuration,
      JSON.parse(git("show", `${head}:${file}`)).configuration,
    );
    const base = basePresets.get(mode) ?? `${since}:${file}`;
    return {
      title: `Preset ${mode} (${base} → ${head}:${file})`,
      items: settings.map(([setting, details]) => ({ id: `preset:${mode}:${setting}`, text: setting, details })),
    };
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

function contractItems(since, head) {
  const constants = diffConstants(
    constantsOf(treeSources(since, CONTRACTS_BEFORE)),
    constantsOf(treeSources(head, [CONTRACTS_NOW])),
  ).map((line) => ({ id: `const:${line.match(/^\w+ ([A-Z0-9_]+)/)[1]}`, text: line }));
  const rules = git("grep", "-n", "-E", "modeRules", head, "--", "config/source")
    .split("\n")
    .filter(Boolean)
    .map((line) => line.replace(`${head}:`, ""))
    .map((line) => ({ id: `rules:${line.split(":").slice(0, 2).join(":")}`, text: `mode rules: ${line}` }));
  return { title: "Contract rules", items: [...constants, ...rules] };
}

function featureItems(since, head) {
  const before = new Set(featuresOf(gitOr("", "show", `${since}:${FEATURE_MAP}`)));
  const now = featuresOf(git("show", `${head}:${FEATURE_MAP}`));
  // An id is plain text (no code spans), so a checklist line and a coverage key read the same.
  const item = (change, feature) => ({ id: `feature:${feature.replaceAll("`", "")}`, text: `${change} ${feature}` });
  return {
    title: `Features (${FEATURE_MAP})`,
    items: [
      ...now.filter((feature) => !before.has(feature)).map((feature) => item("added", feature)),
      ...[...before].filter((feature) => !now.includes(feature)).map((feature) => item("removed", feature)),
    ],
  };
}

function changeListItems(since, head) {
  const deletion = gitOr("", "log", "-1", "--format=%H", "--diff-filter=D", head, "--", CHANGE_LIST).trim();
  const source = gitOr("", "show", deletion ? `${deletion}^:${CHANGE_LIST}` : `${head}:${CHANGE_LIST}`);
  const day = git("show", "-s", "--format=%cs", since).trim();
  return {
    title: `The retired change list's entries since ${day}`,
    items: changeListOf(source)
      .filter((entry) => entry.day >= day)
      .map((entry) => ({ id: `log:${entry.day} ${entry.title}`, text: `${entry.title}: ${entry.description}` })),
  };
}

function commitItems(since, head) {
  const log = git("log", "--no-merges", "--format=@@%h %s", "--abbrev=11", "--name-only", `${since}..${head}`);
  return {
    title: "Commits",
    items: log
      .split("@@")
      .filter(Boolean)
      .map((block) => {
        const [subject, ...files] = block.trim().split("\n").filter(Boolean);
        const [hash, ...words] = subject.split(" ");
        return { id: `commit:${hash}`, text: `${areaOf(files)} · ${words.join(" ")}` };
      }),
  };
}

function renderChecklist(since, head, groups) {
  const out = [`# Patch notes checklist since ${since}`, "", `Head ${git("rev-parse", "--short=11", head).trim()}`, ""];
  for (const { title, items } of groups) {
    out.push(`## ${title} (${items.length})`, "");
    for (const { id, text, details = [] } of items) {
      out.push(`- \`${id}\` ${text}`);
      for (const detail of details) out.push(`  - ${detail}`);
    }
    out.push("");
  }
  return out.join("\n");
}

const cell = (text) => text.replace(/\|/g, "\\|").replace(/\s+/g, " ").slice(0, 140);

function renderCoverage({ rows, unmapped, unknownLines, unsourcedLines }, entries) {
  const covered = rows.filter((row) => row.line);
  const out = [
    "## Coverage",
    "",
    `${rows.length} items: ${covered.length} mapped to a line, ${rows.length - covered.length - unmapped.length} left out with a reason, ${unmapped.length} unmapped. Lines the note lacks: ${unknownLines.length}. Lines no item maps to: ${unsourcedLines.length}.`,
    "",
    ...unmapped.map((id) => `- UNMAPPED \`${id}\``),
    ...unknownLines.map((line) => `- NOT IN THE NOTE: ${line}`),
    ...unsourcedLines.map((line) => `- NO SOURCE: ${line}`),
    "",
    "## By line",
    "",
    ...entries.flatMap(({ name, text }) => {
      const sources = covered.filter((row) => row.line === name);
      return [
        `### ${name} (${sources.length})`,
        "",
        `> ${text}`,
        "",
        ...sources.map((row) => `- \`${row.id}\` ${cell(row.text)}`),
        "",
      ];
    }),
    "## Left out",
    "",
    "| Item | What changed | Why left out |",
    "| --- | --- | --- |",
    ...rows
      .filter((row) => !row.line)
      .map((row) => `| \`${cell(row.id)}\` | ${cell(row.text)} | ${row.reason ?? "UNMAPPED"} |`),
  ];
  return out.join("\n");
}

const argument = (name) => {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
};

function main() {
  const since = argument("--since");
  if (!since) throw new Error("usage: patch-notes-checklist.mjs --since <commit> [--head <ref>] [--coverage <file>]");
  const head = argument("--head") ?? "HEAD";
  const basePresets = new Map(
    process.argv.flatMap((arg, index) => (process.argv[index - 1] === "--base-preset" ? [arg.split("=")] : [])),
  );
  const groups = [
    ...presetItems(since, head, basePresets),
    contractItems(since, head),
    featureItems(since, head),
    changeListItems(since, head),
    commitItems(since, head),
  ];
  process.stdout.write(`${renderChecklist(since, head, groups)}\n`);
  const coverageFile = argument("--coverage");
  if (!coverageFile) return;
  const coverage = JSON.parse(readFileSync(coverageFile, "utf8"));
  const entries = entriesOf(readFileSync(coverage.release, "utf8"));
  const result = checkCoverage(
    groups.flatMap((group) => group.items),
    coverage,
    entries,
  );
  process.stdout.write(`${renderCoverage(result, entries)}\n`);
  const gaps = result.unmapped.length + result.unknownLines.length + result.unsourcedLines.length;
  if (gaps > 0) {
    process.stderr.write(`${gaps} gaps: see the Coverage section.\n`);
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
