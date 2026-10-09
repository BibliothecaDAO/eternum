#!/usr/bin/env bun
import defaultFixture from "./wave-fixture";
import { parseArgs } from "node:util";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";
import { encodeNativeCommand } from "@bibliothecadao/provider";
import type { NativeCommand } from "../../../contracts/l3/world-native/schema/commands.gen";
import type { GameClient } from "@bibliothecadao/eternum";
import type { NativeWorldBindings } from "@bibliothecadao/types";
import type { Account } from "starknet";
import bindings from "../../../contracts/l3/world-native/schema/bindings.json";
import { mapWithConcurrency } from "./account-factory";
import { burst } from "./burst-send";
import { now, percentile, save } from "./burst-evidence";
import { waitForLastReceipt, waitForNonemptyClose, type Trigger } from "./follow-up-release";
import { classifyPlayReceipt, type PlayReceipt } from "./player-actions";
import { buildPlayCall, signPlayerInvoke, type PlayBounds } from "./player-invoke";
import type { HeraldConfirmations } from "./game-client";
import type { HarnessProvider } from "./provider";

export interface WavePlayer {
  account: Account;
  client: GameClient;
  heraldConfirmations: HeraldConfirmations;
  command(): NativeCommand | Promise<NativeCommand>;
  verify(store: GameClient["setup"]["store"]): void | Promise<void>;
}
export interface WaveGame {
  gameId: number;
  kind: string;
  rpcUrl: string;
  bounds: PlayBounds;
  provider: HarnessProvider;
  games: string;
  classHash: string;
  nodeImage: string;
  players: WavePlayer[];
  /** Verify aggregate real-contract effects, never the spike's shared probe counter. */
  verify(): Promise<void>;
  dispose(): void;
}
export interface WaveFixturePort {
  createGame(players: number): Promise<WaveGame>;
}
export interface WaveOptions {
  players: number;
  workers: number;
  timeoutMs: number;
  out: string;
  checkpoint?: string;
  readyFile?: string;
  closeLog?: string;
  offsetMs?: number;
  receiptCheckpoint?: string;
}

async function runWave(port: WaveFixturePort, options: WaveOptions) {
  const run = Date.now();
  let game: WaveGame | undefined;
  let result: Record<string, unknown> = {
    status: "preparing",
    passed: false,
    accounts: options.players,
    run,
    arm: "Y",
    tier: 2,
  };
  save(options.out, result);
  try {
    game = await port.createGame(options.players);
    validateWave(game, options);
    const fixture = game;
    result = { ...result, ...waveHeader(game) };
    save(options.out, result);
    const payloads = await prepareWavePayloads(game);
    let trigger: Trigger | null = null;
    const rows = await burst(game.rpcUrl, payloads, options.workers, async () => {
      const ready = () => {
        if (options.readyFile) save(options.readyFile, { readyNs: String(now()), accounts: options.players });
      };
      if (options.closeLog) trigger = await waitForNonemptyClose(options.closeLog, options.timeoutMs, ready);
      else {
        ready();
        if (options.checkpoint)
          trigger = await waitForLastReceipt(options.checkpoint, options.offsetMs ?? 0, options.timeoutMs);
      }
    });
    const first = rows.reduce(
      (at, row) => (BigInt(row.sentNs) < at ? BigInt(row.sentNs) : at),
      BigInt(rows[0]!.sentNs),
    );
    const spreadMs =
      Number(rows.reduce((at, row) => (BigInt(row.sentNs) > at ? BigInt(row.sentNs) : at), first) - first) / 1e6;
    const actions = await mapWithConcurrency(rows, 64, async (row) => {
      const index = payloads.findIndex((payload) => payload.hash === row.hash);
      const player = fixture.players[index]!;
      player.client.runtime.recordSubmittedTransaction(row.hash);
      return observeWaveAction(fixture, player, row, first, options.timeoutMs);
    });
    await fixture.verify();
    const evidence = waveEvidence(rows, actions, first, spreadMs, trigger, options.players);
    if (options.receiptCheckpoint)
      save(options.receiptCheckpoint, { completed: evidence.completed, lastReceiptNs: evidence.lastReceiptNs });
    result = { ...result, ...evidence };
  } catch {
    result = {
      ...result,
      status: "failed",
      passed: false,
      error: "wave did not complete; inspect route/fact prerequisites without publishing request bodies",
    };
  } finally {
    try {
      game?.dispose();
    } catch {
      result = { ...result, passed: false, status: "failed", error: "fixture disposal failed" };
    }
    save(options.out, result);
  }
  return result;
}

function waveHeader(game: WaveGame) {
  return {
    game: { id: game.gameId, arm: "Y", kind: game.kind },
    chainId: game.bounds.chainId,
    contract: game.games,
    classHash: game.classHash,
    nodeImage: game.nodeImage,
    writes: 1,
    hashes: 1,
    visibleDefinition:
      "first PRE_CONFIRMED or confirmed transaction arrival on the subscribed Herald observer; every effect verified through Herald",
  };
}

function waveEvidence(
  rows: Awaited<ReturnType<typeof burst>>,
  actions: Awaited<ReturnType<typeof observeWaveAction>>[],
  first: bigint,
  spreadMs: number,
  trigger: Trigger | null,
  players: number,
) {
  const successful = actions.filter((action) => action.applied);
  const latencies = successful.map((action) => action.receiptMs!);
  const completed = successful.length;
  const lastVisibleMs = latencies.length ? Math.max(...latencies) : null;
  const domain = { verifiedPlayers: completed };
  const lastReceiptNs =
    completed === players
      ? String(
          actions.reduce((at, action) => (BigInt(action.receiptNs ?? 0) > at ? BigInt(action.receiptNs!) : at), 0n),
        )
      : null;
  const roundTrips = rows.flatMap((row) =>
    row.acknowledgedNs ? [Number(BigInt(row.acknowledgedNs) - BigInt(row.sentNs)) / 1e6] : [],
  );
  const quiet =
    players === 24
      ? {
          mode: "24 simultaneous genuine CreateExplorer Y actions;independent game and actors",
          actualOffsetMs: trigger ? Number(first - BigInt(trigger.observedNs)) / 1e6 : null,
          targetLatenessMs: trigger ? Number(first - BigInt(trigger.targetNs)) / 1e6 : null,
          spreadMs,
          lastReceiptNs,
          acknowledgementRoundTrip: {
            sampleCount: roundTrips.length,
            p50Ms: percentile(roundTrips, 0.5),
            p95Ms: percentile(roundTrips, 0.95),
          },
        }
      : {};
  const complete = completed === players && actions.every((action) => !action.error);
  const releaseValid = spreadMs < 100;
  return {
    status: "finished",
    passed: complete && releaseValid && lastVisibleMs !== null && lastVisibleMs < 5000,
    firstSendNs: String(first),
    lastReceiptNs,
    sendSpreadMs: spreadMs,
    releaseValid,
    completed,
    lastVisibleMs,
    p50Ms: percentile(latencies, 0.5),
    p95Ms: percentile(latencies, 0.95),
    stretch: complete && releaseValid && lastVisibleMs !== null && lastVisibleMs < 2000,
    streamError: null,
    trigger,
    actions,
    domain,
    ...quiet,
  };
}

async function prepareWavePayloads(game: WaveGame) {
  return mapWithConcurrency(game.players, 8, async (player) => {
    const command = encodeNativeCommand(
      (bindings as unknown as NativeWorldBindings).commandAbi,
      await player.command(),
    );
    const pin = player.client.setup.store.require("GameRelease", { game_id: game.gameId });
    return signPlayerInvoke(
      player.account,
      buildPlayCall(game.games, game.gameId, pin.release_id, pin.preset_commitment, command),
      game.bounds,
    );
  });
}

export function validateWave(game: WaveGame, options: WaveOptions): void {
  if (![24, 2000].includes(options.players) || game.players.length !== options.players)
    throw new Error("Wave requires exactly 24 or 2000 players");
  if (new Set(game.players.map((player) => BigInt(player.account.address).toString())).size !== options.players)
    throw new Error("Wave accounts must be distinct");
  if (
    game.players.some(
      (player) =>
        player.client.gameId !== game.gameId ||
        BigInt(player.client.shard.chainId) !== BigInt(game.bounds.chainId) ||
        BigInt(player.client.shard.worldAddress) !== BigInt(game.games) ||
        player.client.shard.rpcUrl !== game.rpcUrl,
    )
  )
    throw new Error("Wave player manifest scope differs");
  if (options.closeLog && options.checkpoint) throw new Error("Choose one quiet-window trigger");
  if (options.players === 24 && game.kind !== "CreateExplorer")
    throw new Error("Quiet fixture requires genuine CreateExplorer actions");
  if (options.players === 24 && !options.closeLog && !options.checkpoint)
    throw new Error("Quiet window requires a primary receipt checkpoint or nonempty close log");
}

async function observeWaveAction(
  game: WaveGame,
  player: WavePlayer,
  row: { hash: string; sentNs: string; acknowledgedNs: string | null; error: string | null },
  first: bigint,
  timeoutMs: number,
) {
  const deadline = now() + BigInt(timeoutMs) * 1_000_000n;
  let receiptNs: bigint | undefined;
  const herald = player.client.runtime.waitForTransaction(row.hash);
  void herald.catch(() => {});
  while (now() < deadline) {
    try {
      const receipt = (await game.provider.getTransactionReceipt(row.hash)) as PlayReceipt;
      if (receiptNs === undefined) {
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          receiptNs = await Promise.race([
            player.heraldConfirmations.firstObserved(row.hash),
            new Promise<never>((_, reject) => {
              timer = setTimeout(
                () => reject(new Error("Herald visibility deadline")),
                Math.max(1, Number(deadline - now()) / 1e6),
              );
            }),
          ]);
        } finally {
          clearTimeout(timer);
        }
      }
      const outcome = classifyPlayReceipt(receipt, {
        gameId: game.gameId,
        actor: player.account.address,
        games: game.games,
        hash: row.hash,
      });
      if (outcome.state !== "pending") {
        if (outcome.state === "rejected")
          return {
            ...row,
            receiptNs: String(receiptNs),
            receiptMs: Number(receiptNs - first) / 1e6,
            applied: false,
            executionStatus: receipt.execution_status,
            error: outcome.reason,
          };
        const remainingMs = Math.max(1, Number(deadline - now()) / 1e6);
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          await Promise.race([
            herald,
            new Promise<never>((_, reject) => {
              timer = setTimeout(() => reject(new Error("Herald timeout")), remainingMs);
            }),
          ]);
          await player.verify(player.client.setup.store);
        } finally {
          clearTimeout(timer);
        }
        return {
          ...row,
          error: null,
          receiptNs: String(receiptNs),
          receiptMs: Number(receiptNs - first) / 1e6,
          executionStatus: receipt.execution_status,
          applied: true,
        };
      }
    } catch {
      /* Receipt visibility may lag submission. Retry reads, never invokes. */
    }
    await sleep(250);
  }
  return {
    ...row,
    receiptNs: receiptNs ? String(receiptNs) : null,
    receiptMs: receiptNs ? Number(receiptNs - first) / 1e6 : null,
    applied: false,
    error: "receipt or Herald fact verification deadline",
  };
}

if (import.meta.main) {
  try {
    const { values } = parseArgs({
      options: {
        fixture: { type: "string" },
        out: { type: "string" },
        players: { type: "string", default: "2000" },
        workers: { type: "string", default: "4" },
        "timeout-ms": { type: "string", default: "120000" },
        checkpoint: { type: "string" },
        "close-log": { type: "string" },
        "offset-ms": { type: "string" },
        "ready-file": { type: "string" },
        "receipt-checkpoint": { type: "string" },
      },
    });
    if (!values.out) throw new Error("Output path required");
    const players = Number(values.players),
      workers = Number(values.workers),
      timeoutMs = Number(values["timeout-ms"]);
    if (
      ![24, 2000].includes(players) ||
      !Number.isSafeInteger(workers) ||
      workers < 1 ||
      workers > 64 ||
      !Number.isSafeInteger(timeoutMs) ||
      timeoutMs <= 0
    )
      throw new Error("Invalid wave arguments");
    const port = values.fixture
      ? ((await import(pathToFileURL(resolve(values.fixture)).href)).default as WaveFixturePort)
      : defaultFixture;
    const result = await runWave(port, {
      players,
      workers,
      timeoutMs,
      out: resolve(values.out),
      checkpoint: values.checkpoint,
      closeLog: values["close-log"],
      offsetMs: Number(values["offset-ms"] ?? "0"),
      readyFile: values["ready-file"],
      receiptCheckpoint: values["receipt-checkpoint"],
    });
    console.log(
      JSON.stringify({
        result: resolve(values.out),
        passed: result.passed,
        completed: result.completed,
        lastVisibleMs: result.lastVisibleMs,
      }),
    );
    process.exitCode = result.passed ? 0 : 1;
  } catch {
    console.error("Wave fixture or arguments failed; no credentials emitted");
    process.exitCode = 1;
  }
}
