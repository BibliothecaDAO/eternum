import { parseArgs } from "node:util";
import { hash } from "starknet";
import { deviceKeyOf, joinBotAccount } from "@bibliothecadao/eternum";
import { openShard } from "@bibliothecadao/eternum/game-client";
import bindings from "../../../contracts/l3/world-native/schema/bindings.json";
import type { NativeWorldManifest } from "../../../config/deployer/clean/world/native/types";
import { nativePresetIdFor } from "../../../config/source/native";
import { readShardManifest } from "../../../packages/chain/shard-manifest.js";
import { splitPlaytestRoster } from "../../../packages/value-ledger/src/blitz-roster";
import { BLITZ_SLOT_PREPARATION_SECONDS } from "../../../packages/value-ledger/src/blitz-slots";
import { seaterLabels } from "../../../packages/value-ledger/src/shard-accounts";
import { LaunchShard, type BlitzLaunch } from "../../../apps/launch-service/src/shard-client";
import { RegistrationOpen } from "../../../apps/launch-service/src/blitz-roster";
import { createHarnessAdminProvider } from "./game-setup";
import { now, percentile, save } from "./burst-evidence";

/**
 * How long the launch Worker's own path takes to seat a frozen Blitz roster of PLAYERS: the roster is split into games
 * by the production rule, the games are dealt to the seater pool round-robin by group index, and one
 * `LaunchShard.launchBlitz` creates them all and seats each through its seater's pipeline, as the registrar does for a
 * closed slot. The pool joins first, through the private node, with the operator's device as the Worker's. Roster
 * entries are synthetic addresses: the chain checks a roster's size, not its accounts. Measurement shards only (the
 * harness's operator is their launcher). Usage: bun blitz-split.ts --players 2000 --out FILE, with HERALD_URL,
 * NATIVE_WORLD_MANIFEST, HARNESS_ADMIN_RPC_URL, IDENTITY_URL, OPERATOR_TOKEN, DEPLOYER_ACCOUNT_ADDRESS and
 * DEPLOYER_PRIVATE_KEY.
 */
const GAME_SECONDS = 3_600;

async function main(): Promise<void> {
  const { values } = parseArgs({ options: { players: { type: "string" }, out: { type: "string" } } });
  const players = Number(values.players);
  if (!Number.isInteger(players) || players < 1 || !values.out) throw new Error("Usage: --players N --out FILE");
  const manifest = readShardManifest<NativeWorldManifest>(required("NATIVE_WORLD_MANIFEST"));
  const shard = await openShard(required("HERALD_URL"), bindings.schemaIdentity);
  const operator = {
    accountAddress: required("DEPLOYER_ACCOUNT_ADDRESS"),
    privateKey: required("DEPLOYER_PRIVATE_KEY"),
  };
  const poolStarted = now();
  const seaters = await joinSeaterPool(shard, operator.privateKey);
  const poolJoinMs = milliseconds(poolStarted);
  const launcher = new LaunchShard({
    rpcUrl: shard.rpcUrl,
    chainId: manifest.shard.chainId,
    gamesAddress: manifest.world.address,
    ...operator,
  });
  const launches = slotLaunches(players, seaters, Date.now());
  const startedAt = new Date().toISOString();
  const started = now();
  const { summaries, registrationWaitMs } = await launchWhenSettlingOpens(launcher, launches);
  const wholeSplitMs = milliseconds(started);
  const seats = summaries.map((summary) => summary.settlementTransactions ?? 0);
  save(values.out, {
    players,
    games: summaries.length,
    seaters: seaters.length,
    poolJoinMs,
    startedAt,
    endedAt: new Date().toISOString(),
    registrationWaitMs,
    wholeSplitMs,
    seatingMs: wholeSplitMs - registrationWaitMs,
    transactions: { create: summaries.length, seat: seats.reduce((sum, count) => sum + count, 0) },
    seatsPerGame: summary(seats),
    gameDetails: summaries.map((game, index) => ({
      gameId: game.gameId,
      players: launches[index]!.players.length,
      seater: launches[index]!.seater,
      seats: seats[index],
    })),
  });
}

/** The pool the Worker seats from, joined as the Worker joins it: one bot account per seater label, the operator's device. */
async function joinSeaterPool(shard: Awaited<ReturnType<typeof openShard>>, privateKey: string): Promise<string[]> {
  const provider = createHarnessAdminProvider();
  try {
    const identity = { url: required("IDENTITY_URL"), operatorToken: required("OPERATOR_TOKEN") };
    const device = deviceKeyOf(privateKey);
    const accounts = await Promise.all(
      seaterLabels.map((label) => joinBotAccount({ provider, shard, label, device, identity })),
    );
    return accounts.map((account) => account.address);
  } finally {
    provider.dispose();
  }
}

/** A closed slot of PLAYERS as the Worker launches it: the production split, each group's seater dealt by its index. */
export function slotLaunches(players: number, seaters: readonly string[], runStartedAt: number): BlitzLaunch[] {
  const run = runStartedAt.toString(36);
  return splitPlaytestRoster(syntheticRoster(players, BigInt(runStartedAt))).map((roster, groupIndex) =>
    blitzLaunch(run, groupIndex, roster, seaters[groupIndex % seaters.length]!),
  );
}

/** One game of the slot: settling opens now, play in the preparation window's length, as a closed slot's games do. */
function blitzLaunch(run: string, groupIndex: number, roster: string[], seater: string): BlitzLaunch {
  const startsAt = Math.ceil(Date.now() / 1000) + BLITZ_SLOT_PREPARATION_SECONDS;
  return {
    request: {
      environment: "madara.blitz",
      version: String(nativePresetIdFor("blitz")),
      gameName: `split-${run}-${groupIndex + 1}`,
      gameStartTime: new Date(startsAt * 1000).toISOString(),
      durationSeconds: GAME_SECONDS,
    },
    players: roster.map((account) => ({ account, wallet: account })),
    createdAt: Date.now(),
    seater,
  };
}

/** The registrar's retry: a slot whose settling has not opened yet runs again once it has. */
async function launchWhenSettlingOpens(launcher: LaunchShard, launches: BlitzLaunch[]) {
  let registrationWaitMs = 0;
  for (;;) {
    try {
      return { summaries: await launcher.launchBlitz(launches), registrationWaitMs };
    } catch (error) {
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

const required = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} required for the Blitz split`);
  return value;
};

if (import.meta.main) await main();
