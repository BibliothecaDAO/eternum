import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AssistantMessage } from "@mariozechner/pi-ai";

import type { Delivery, StopReason, WakeReason } from "./wake";

export type ActionOutcomeKind = "planned" | "confirmed" | "refused" | "failed";

export interface ActionOutcome {
  kind: ActionOutcomeKind;
  /** The classified transaction error kind, or tool_error when the tool itself threw. */
  failureClass?: string;
}

export type ModelUsage = AssistantMessage["usage"];

export interface RunManifestInput {
  dataDir: string;
  chain: { chain: string; rpcUrl: string; heraldUrl: string };
  game: { gameId: number; gameName: string; mode: string | null; viewer: string };
  model: { profile: string; id: string };
  startedAt?: Date;
}

interface TickCounts {
  woken: number;
  actionable: number;
}

interface ActionCounts {
  planned: number;
  /** Submissions that reached the chain: confirmed plus failed. Refusals never leave the runner. */
  attempted: number;
  confirmed: number;
  refused: number;
  failed: number;
}

/** The per-game run manifest: the harness report's header shape plus the LLM and action ledger a cost model needs. */
export interface RunManifest {
  schemaVersion: 1;
  runId: string;
  createdAt: string;
  endedAt: string | null;
  status: "running" | "stopped";
  stopReason: StopReason | null;
  chain: RunManifestInput["chain"];
  game: RunManifestInput["game"];
  model: RunManifestInput["model"];
  loop: {
    ticks: number;
    byReason: Record<WakeReason, TickCounts>;
    deliveries: Record<Delivery, number>;
  };
  llm: {
    calls: number;
    tokens: { input: number; output: number; cacheRead: number; cacheWrite: number };
    costUsd: number;
  };
  actions: ActionCounts & {
    byKind: Record<string, ActionCounts>;
    failureClasses: Record<string, number>;
  };
  runtime: { wallTimeMs: number; rssMb: number };
}

export interface RunManifestRecorder {
  recordTick(reason: WakeReason, actionable: boolean, delivery: Delivery): void;
  recordModelCall(usage: ModelUsage): void;
  recordAction(action: string, outcome: ActionOutcome): void;
  finish(stopReason: StopReason): void;
  snapshot(): RunManifest;
  /** Writes `<dataDir>/runs/<runId>.json` through a temp file and rename, so a reader never sees a torn manifest. */
  write(): Promise<string>;
}

const RUNS_DIR = "runs";

export const createRunManifest = (input: RunManifestInput): RunManifestRecorder => {
  const startedAt = input.startedAt ?? new Date();
  const manifest = emptyManifest(input, startedAt);
  const outputPath = path.join(input.dataDir, RUNS_DIR, `${manifest.runId}.json`);

  const snapshot = (): RunManifest => {
    manifest.runtime = {
      wallTimeMs: (manifest.endedAt ? Date.parse(manifest.endedAt) : Date.now()) - startedAt.getTime(),
      rssMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
    };
    return structuredClone(manifest);
  };

  return {
    recordTick: (reason, actionable, delivery) => {
      manifest.loop.ticks += 1;
      manifest.loop.byReason[reason].woken += 1;
      if (actionable) manifest.loop.byReason[reason].actionable += 1;
      manifest.loop.deliveries[delivery] += 1;
    },
    recordModelCall: (usage) => {
      manifest.llm.calls += 1;
      manifest.llm.tokens.input += usage.input;
      manifest.llm.tokens.output += usage.output;
      manifest.llm.tokens.cacheRead += usage.cacheRead;
      manifest.llm.tokens.cacheWrite += usage.cacheWrite;
      manifest.llm.costUsd += usage.cost.total;
    },
    recordAction: (action, outcome) => {
      const byKind = (manifest.actions.byKind[action] ??= emptyActionCounts());
      countAction(manifest.actions, outcome);
      countAction(byKind, outcome);
      if (outcome.kind === "failed") {
        const failureClass = outcome.failureClass ?? "unknown";
        manifest.actions.failureClasses[failureClass] = (manifest.actions.failureClasses[failureClass] ?? 0) + 1;
      }
    },
    finish: (stopReason) => {
      manifest.status = "stopped";
      manifest.stopReason = stopReason;
      manifest.endedAt = new Date().toISOString();
    },
    snapshot,
    write: async () => {
      await writeAtomically(outputPath, `${JSON.stringify(snapshot(), null, 2)}\n`);
      return outputPath;
    },
  };
};

const emptyManifest = (input: RunManifestInput, startedAt: Date): RunManifest => ({
  schemaVersion: 1,
  runId: startedAt.toISOString().replace(/[-:.]/g, ""),
  createdAt: startedAt.toISOString(),
  endedAt: null,
  status: "running",
  stopReason: null,
  chain: input.chain,
  game: input.game,
  model: input.model,
  loop: {
    ticks: 0,
    byReason: {
      startup: { woken: 0, actionable: 0 },
      "world-delta": { woken: 0, actionable: 0 },
      direction: { woken: 0, actionable: 0 },
      heartbeat: { woken: 0, actionable: 0 },
      "phase-change": { woken: 0, actionable: 0 },
    },
    deliveries: { prompted: 0, steered: 0, "followed-up": 0, coalesced: 0, skipped: 0 },
  },
  llm: { calls: 0, tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, costUsd: 0 },
  actions: { ...emptyActionCounts(), byKind: {}, failureClasses: {} },
  runtime: { wallTimeMs: 0, rssMb: 0 },
});

const emptyActionCounts = (): ActionCounts => ({ planned: 0, attempted: 0, confirmed: 0, refused: 0, failed: 0 });

const countAction = (counts: ActionCounts, outcome: ActionOutcome): void => {
  counts[outcome.kind] += 1;
  if (outcome.kind === "confirmed" || outcome.kind === "failed") counts.attempted += 1;
};

const writeAtomically = async (file: string, content: string): Promise<void> => {
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  await writeFile(temp, content);
  await rename(temp, file);
};
