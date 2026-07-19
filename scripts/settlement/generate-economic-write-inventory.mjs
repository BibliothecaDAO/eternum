import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "../..");
const gameSourceRoot = resolve(repositoryRoot, "contracts/game/src");
const outputPath = resolve(repositoryRoot, "packages/settlement-codec/schema/economic-write-inventory-v0.json");
const shouldCheck = process.argv.includes("--check");

const entries = scanEconomicWrites();
const inventory = {
  version: 0,
  status: "a9-feasibility-inventory",
  sourceRoot: "contracts/game/src",
  detectorKinds: ["write_model", "delete_model", "write_member", "set_member", "write", "store"],
  summary: summarize(entries),
  entries,
};
const rendered = `${JSON.stringify(inventory, null, 2)}\n`;

if (shouldCheck) {
  const current = readFileSync(outputPath, "utf8");
  if (JSON.stringify(JSON.parse(current)) !== JSON.stringify(inventory)) {
    throw new Error(`stale generated economic write inventory: ${relative(repositoryRoot, outputPath)}`);
  }
} else {
  writeFileSync(outputPath, rendered);
}

function scanEconomicWrites() {
  const entries = [];
  for (const absolutePath of walkCairoFiles(gameSourceRoot)) {
    const path = relative(repositoryRoot, absolutePath);
    if (isTestSource(path)) continue;

    const lines = readFileSync(absolutePath, "utf8").split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const source = stripLineComment(lines[index]).trim();
      const match = source.match(
        /(?:([A-Za-z_][A-Za-z0-9_:.()]*)\s*)?\.(write_model|delete_model|write_member|set_member|write|store)\s*\(/,
      );
      if (!match) continue;

      const receiver = match[1] ?? resolveMultilineReceiver(lines, index);
      const target = resolveTarget(lines, index, receiver, match[2]);
      const classification = classifyWrite(path, target);
      entries.push({
        id: `${path}:${index + 1}:${match[2]}`,
        path,
        line: index + 1,
        detectorKind: match[2],
        target,
        classification: classification.family,
        exitCoveredCandidate: classification.exitCoveredCandidate,
        reason: classification.reason,
        source,
      });
    }
  }
  return entries.sort((left, right) => left.path.localeCompare(right.path) || left.line - right.line);
}

function* walkCairoFiles(directory) {
  for (const name of readdirSync(directory).sort()) {
    const path = resolve(directory, name);
    if (statSync(path).isDirectory()) {
      yield* walkCairoFiles(path);
    } else if (name.endsWith(".cairo")) {
      yield path;
    }
  }
}

function isTestSource(path) {
  return /(^|\/)(tests?|test_[^/]*)($|\/|\.cairo$)/.test(path);
}

function stripLineComment(line) {
  return line.split("//", 1)[0];
}

function resolveMultilineReceiver(lines, index) {
  for (let cursor = index - 1; cursor >= Math.max(0, index - 5); cursor -= 1) {
    const candidate = stripLineComment(lines[cursor]).trim();
    if (!candidate) continue;
    const receiver = candidate.match(/([A-Za-z_][A-Za-z0-9_:.()]*)\s*$/)?.[1];
    if (receiver) return receiver;
  }
  return "multiline_receiver";
}

function resolveTarget(lines, index, receiver, detectorKind) {
  if (detectorKind !== "write_model" && detectorKind !== "delete_model") return receiver;
  const callWindow = lines.slice(index, index + 5).join(" ");
  const typeMatch = callWindow.match(/@\s*([A-Z][A-Za-z0-9_]*)/);
  return typeMatch?.[1] ?? receiver;
}

function classifyWrite(path, target) {
  const value = `${path} ${target}`.toLowerCase();

  if (/resource\/arrivals|arrival/.test(value)) return economic("arrival", "arrival or in-transit value state");
  if (/resource\/production|production|building/.test(value)) {
    return economic("lazy_production", "lazy production, producer, or reserved output state");
  }
  if (/combat|troop|explorer|guard|cargo/.test(value)) {
    return economic("military_and_cargo", "troop, explorer, guard, combat, or surviving cargo state");
  }
  if (/trade|order|donkey/.test(value)) return economic("trade_and_donkey", "trade order or DONKEY escrow state");
  if (/bank|liquidity|amm|swap/.test(value)) return economic("amm_and_lp", "bank reserve, AMM, or wallet LP state");
  if (/withdraw|liability|batchassigned/.test(value)) {
    return economic("pending_withdrawal", "withdrawal journal or settlement assignment state");
  }
  if (/backing|capacity|lotshare/.test(value)) {
    return economic("active_exit_backing", "active-exit parent or lot accounting state");
  }
  if (/exitposition|positionref/.test(value)) return economic("exit_position", "exit position or stable index state");
  if (/playerlock|forcedexit|economicallylocked/.test(value)) {
    return economic("player_economic_lock", "player economic lock or terminal exit state");
  }
  if (/faith|prize|blitz|participant|points|hyperstructure|relic|artificer|bitcoin/.test(value)) {
    return economic("reward_state", "fee, prize, Faith, Blitz, or outcome-bearing participant state");
  }
  if (/structure|owner|ownership|realm|village/.test(value)) {
    return economic("structure_ownership", "structure/entity ownership or attached position state");
  }
  if (/resource|weight/.test(value)) return economic("resource", "resource balance or capacity weight state");

  return {
    family: "out_of_scope",
    exitCoveredCandidate: false,
    reason:
      "Non-economic config, map, guild, naming, quest, achievement, RNG, lifecycle, or administrative state; A22 must confirm the exclusion.",
  };
}

function economic(family, reason) {
  return { family, exitCoveredCandidate: true, reason };
}

function summarize(allEntries) {
  const byClassification = {};
  for (const entry of allEntries) {
    byClassification[entry.classification] = (byClassification[entry.classification] ?? 0) + 1;
  }
  return {
    writes: allEntries.length,
    files: new Set(allEntries.map((entry) => entry.path)).size,
    exitCoveredCandidates: allEntries.filter((entry) => entry.exitCoveredCandidate).length,
    outOfScopeCandidates: allEntries.filter((entry) => !entry.exitCoveredCandidate).length,
    unclassified: allEntries.filter((entry) => entry.classification === "unclassified").length,
    byClassification,
  };
}
