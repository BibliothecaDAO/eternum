import { sourceProvenance } from "./source-provenance";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { SliceActionEvidence } from "./action-evidence";
import parity from "../../../../contracts/l3/world-native/fixtures/world-parity.json";
import bindings from "../../../../contracts/l3/world-native/schema/bindings.json";

interface SliceRun {
  provenance: { dirty: boolean; sourceSha256: string };
  host: { gitDirty: boolean };
  passed: boolean;
  poolOverrides: boolean;
  coverage: { defeatedExplorer: number; surfaceMine: number; bitcoinMine: number; reconnected: boolean };
  workloadStartedAt: string;
  workloadEndedAt: string;
  actions: SliceActionEvidence[];
}

const [dojoPath, nativePath] = process.argv.slice(2);
if (!dojoPath || !nativePath) throw new Error("Usage: compare-slices.ts DOJO_REPORT NATIVE_REPORT");
const dojo = await readRun(dojoPath);
const native = await readRun(nativePath);
validatePair(dojo.run, native.run);
const source = await sourceProvenance(false);
if (native.run.provenance.sourceSha256 !== source.sourceSha256)
  throw new Error("Measured source differs from the current source");
const report = buildComparison();
const output = resolve(import.meta.dir, "../../../../contracts/l3/world-native/fixtures/harness.json");
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ passed: report.passed, output, summary: report.summary }));

async function readRun(path: string) {
  const raw = await readFile(path, "utf8");
  return { run: JSON.parse(raw) as SliceRun, sha256: createHash("sha256").update(raw).digest("hex") };
}

function validatePair(left: SliceRun, right: SliceRun) {
  if (!parity.passed) throw new Error("The paired-world parity gate has not passed");
  for (const run of [left, right]) {
    if (run.provenance?.dirty !== false || run.host.gitDirty !== false)
      throw new Error("Run has no clean-tree provenance");
    if (!run.passed || run.poolOverrides) throw new Error("Slice failed or changed the discovery pool");
    if (
      !run.coverage?.reconnected ||
      !run.coverage.surfaceMine ||
      !run.coverage.bitcoinMine ||
      !run.coverage.defeatedExplorer
    )
      throw new Error("Missing two-layer discovery, deletion or reconnect evidence");
    if (run.actions.length !== 8) throw new Error("Comparison requires the matched eight-action workload");
    if (run.actions.some((action) => action.preconfirmedRowMs === null))
      throw new Error("An action has no pre-confirmed row observation");
  }
  if (left.provenance.sourceSha256 !== right.provenance.sourceSha256) throw new Error("Runs used different sources");
  const sequence = (run: SliceRun) => run.actions.map((action) => `${action.action}:${action.layer}`).join(",");
  if (sequence(left) !== sequence(right)) throw new Error("Native and Dojo action sequences differ");
}

function buildComparison() {
  return {
    version: 1,
    gate: "native-two-layer-shared-client",
    passed: true,
    rulesRevision: parity.rulesRevision,
    schemaIdentity: bindings.schemaIdentity,
    parity: { passed: parity.passed, cases: parity.cases.length, evidence: "world-parity.json" },
    measurement: {
      client: "@bibliothecadao/eternum/game-client",
      state: "Herald snapshot and ordered diffs applied to RECS; RPC reads only receipts and deployment setup",
      randomness:
        "Prepared raw roots run through the original full pools; preparation is outside the action latency clock",
      gas: "Full transaction receipts: Dojo random actions include the dev root fixture; native actions include signed intent authentication",
      explore: "Dojo explorer_move(explore=true); reward extraction is a separate, unported action",
      execution: "Elapsed execution from an isolated one-transaction batch in unchanged Madara logs",
      latency: "Submission start to shared-client RECS application of a diff observed with preconfirmed=true",
      throughput: "Eight actions divided by wall time, including normal stamina waits; not saturation capacity",
      percentiles:
        "Nearest rank over eight heterogeneous actions per deployment; descriptive samples, not a latency SLO",
    },
    summary: { dojo: summarize(dojo.run), native: summarize(native.run) },
    dojo,
    native,
  };
}

function summarize(run: SliceRun) {
  const seconds = (Date.parse(run.workloadEndedAt) - Date.parse(run.workloadStartedAt)) / 1000;
  if (!(seconds > 0)) throw new Error("Invalid workload duration");
  return {
    actions: run.actions.length,
    elapsedSeconds: seconds,
    observedActionsPerSecond: run.actions.length / seconds,
    executionMs: percentiles(run.actions.map((action) => action.executionMs)),
    preconfirmedRowMs: percentiles(run.actions.map((action) => action.preconfirmedRowMs!)),
    eventCount: run.actions.reduce((total, action) => total + action.events, 0),
    eventFelts: run.actions.reduce((total, action) => total + action.eventFelts, 0),
    l2Gas: run.actions.reduce(
      (total, action) => total + Number((action.executionResources as { l2_gas: number }).l2_gas),
      0,
    ),
  };
}

function percentiles(values: number[]) {
  if (values.some((value) => !Number.isFinite(value) || value < 0)) throw new Error("Invalid timing observation");
  const sorted = [...values].sort((a, b) => a - b);
  return Object.fromEntries(
    [50, 95, 99].map((rank) => [`p${rank}`, sorted[Math.ceil((rank / 100) * sorted.length) - 1]]),
  );
}
