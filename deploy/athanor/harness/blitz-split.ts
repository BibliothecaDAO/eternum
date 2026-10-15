import { parseArgs } from "node:util";
import { hash } from "starknet";
import { openShard } from "@bibliothecadao/eternum/game-client";
import bindings from "../../../contracts/l3/world-native/schema/bindings.json";
import type { NativeWorldManifest } from "../../../config/deployer/clean/world/native/types";
import { nativePresetIdFor } from "../../../config/source/native";
import { readShardManifest } from "../../../packages/chain/shard-manifest.js";
import { splitPlaytestRoster } from "../../../packages/value-ledger/src/blitz-roster";
import { LaunchShard } from "../../../apps/launch-service/src/shard-client";
import { RegistrationOpen } from "../../../apps/launch-service/src/blitz-roster";
import { now, percentile, save } from "./burst-evidence";

/**
 * How long the launcher takes to seat a frozen Blitz roster of PLAYERS: the roster is split into games by the
 * production rule, and each game is created and seated through the launch Worker's own `LaunchShard`, one game after
 * another, as its registrar runs them on one signing stream. Roster entries are synthetic addresses: the chain checks a
 * roster's size, not its accounts, and only the launcher transacts. Measurement shards only (the harness's operator is
 * their launcher). Usage: bun blitz-split.ts --players 2000 --out FILE, with HERALD_URL, NATIVE_WORLD_MANIFEST,
 * DEPLOYER_ACCOUNT_ADDRESS and DEPLOYER_PRIVATE_KEY.
 */
const PREPARATION_MS = 300_000; // BLITZ_SLOT_PREPARATION_SECONDS: games are created when settling opens.
const GAME_SECONDS = 3_600;

/** The launcher, timing each SettleBlitzRoster it sends while seating. */
class TimedLaunchShard extends LaunchShard {
  settles: number[] = [];
  override async playCommand(gameId: number, name: Parameters<LaunchShard["playCommand"]>[1]) {
    const started = now();
    const result = await super.playCommand(gameId, name);
    if (name === "SettleBlitzRoster") this.settles.push(milliseconds(started));
    return result;
  }
}

async function main(): Promise<void> {
  const { values } = parseArgs({ options: { players: { type: "string" }, out: { type: "string" } } });
  const players = Number(values.players);
  if (!Number.isInteger(players) || players < 1 || !values.out) throw new Error("Usage: --players N --out FILE");
  const manifest = readShardManifest<NativeWorldManifest>(required("NATIVE_WORLD_MANIFEST"));
  const shard = await openShard(required("HERALD_URL"), bindings.schemaIdentity);
  const launcher = new TimedLaunchShard({
    rpcUrl: shard.rpcUrl,
    chainId: manifest.shard.chainId,
    gamesAddress: manifest.world.address,
    accountAddress: required("DEPLOYER_ACCOUNT_ADDRESS"),
    privateKey: required("DEPLOYER_PRIVATE_KEY"),
  });
  const runStartedAt = Date.now();
  const run = runStartedAt.toString(36);
  const groups = splitPlaytestRoster(syntheticRoster(players, BigInt(runStartedAt)));
  const startedAt = new Date().toISOString();
  const started = now();
  const games = [];
  for (const [index, roster] of groups.entries()) games.push(await seatGame(launcher, run, index, roster));
  save(values.out, {
    players,
    games: games.length,
    startedAt,
    endedAt: new Date().toISOString(),
    wholeSplitMs: milliseconds(started),
    transactions: { create: games.length, settle: launcher.settles.length },
    perGame: summary(games.map((game) => game.createMs + game.seatMs)),
    registrationWait: summary(games.map((game) => game.registrationWaitMs)),
    perSettle: summary(launcher.settles),
    gameDetails: games,
  });
}

async function seatGame(launcher: TimedLaunchShard, run: string, index: number, roster: string[]) {
  const createStarted = now();
  const created = await launcher.create(
    {
      environment: "madara.blitz",
      version: String(nativePresetIdFor("blitz")),
      gameName: `split-${run}-${index + 1}`,
      gameStartTime: new Date(Math.ceil((Date.now() + PREPARATION_MS) / 1000) * 1000).toISOString(),
      durationSeconds: GAME_SECONDS,
    },
    Date.now(),
    undefined,
    roster.map((account) => ({ account, wallet: account })),
  );
  const createMs = milliseconds(createStarted);
  const gameId = created.gameId;
  if (gameId === undefined) throw new Error(`Game ${index + 1} was created without an id`);
  let registrationWaitMs = 0;
  for (;;) {
    const seatStarted = now();
    try {
      const settleTransactions = await launcher.seat(gameId);
      return {
        gameId,
        players: roster.length,
        createMs,
        registrationWaitMs,
        seatMs: milliseconds(seatStarted),
        settleTransactions,
      };
    } catch (error) {
      // A new game's settling opens a moment after creation; the Worker's next run seats it then, and so does this.
      if (!(error instanceof RegistrationOpen)) throw error;
      registrationWaitMs += error.secondsUntilClose * 1_000;
      await Bun.sleep(error.secondsUntilClose * 1_000);
    }
  }
}

/** Distinct, valid contract addresses that belong to nobody. */
const syntheticRoster = (count: number, run: bigint) =>
  Array.from({ length: count }, (_, index) => hash.computePoseidonHashOnElements([run, BigInt(index)])).map(
    (value) => `0x${(BigInt(value) % ((1n << 251n) - 256n)).toString(16)}`,
  );

const summary = (values: number[]) => ({
  count: values.length,
  median: percentile(values, 0.5),
  p90: percentile(values, 0.9),
  max: values.length ? Math.max(...values) : null,
  min: values.length ? Math.min(...values) : null,
  total: values.reduce((sum, value) => sum + value, 0),
});

const milliseconds = (started: bigint) => Number(now() - started) / 1e6;

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} required for the Blitz split`);
  return value;
}

if (import.meta.main) await main();
