#!/usr/bin/env bun
import { CallData, RpcProvider, type Account, type Abi } from "starknet";
import { environmentL2, valuePlaneAddress } from "../../../../../../packages/chain/src/value-plane";
import { readShardManifest } from "../../../../../../packages/chain/shard-manifest.js";
import { assertProviderChain } from "../../../../../../packages/chain/chain-guard.js";
import {
  decodeLedgerPreset,
  decodeFrontierSeason,
  ledgerU256,
  ledgerInteger,
  readConfirmedLedgerHead,
} from "../../../../../../packages/value-ledger/src/codecs";
import {
  assertFrontierPreset,
  readFrontierFunding,
} from "../../../../../../packages/value-ledger/src/frontier-funding";
import { buildFrontierFundingCalls, frontierLedgerPresetId } from "./frontier.js";
import { readConfirmedSnapshot, singleRow } from "../../../../../../apps/value-relay/src/shard-snapshot";
import type { ShardConnection } from "../../../../../../apps/value-relay/src/shard-rpc";

export async function readFrontierGame(
  provider: RpcProvider,
  shard: ShardConnection,
  heraldUrl: string,
  gameId: number,
) {
  if (!Number.isInteger(gameId) || gameId <= 0 || gameId > 0xffffffff) throw new Error("Invalid shard game id");
  await assertProviderChain(provider, { shard: { chainId: shard.chainId } }, "RPC_URL");
  const snapshot = await readConfirmedSnapshot(shard, heraldUrl, gameId, ["GameRegistry", "ChestRules", "SliceRules"]);
  const head = await readConfirmedLedgerHead(provider, snapshot.confirmed_block);
  const contract = await provider.getClassAt(shard.gamesAddress, head.number);
  const abi = typeof contract.abi === "string" ? JSON.parse(contract.abi) : contract.abi;
  if (!Array.isArray(abi)) throw new Error("Shard ABI unavailable");
  const codec = new CallData(abi as Abi);
  const parsed = codec.parse(
    "game",
    await provider.callContract(
      {
        contractAddress: shard.gamesAddress,
        entrypoint: "game",
        calldata: [String(gameId)],
      },
      head.number,
    ),
  );
  if (!parsed || typeof parsed !== "object") throw new Error("Invalid confirmed game");
  const game = parsed as Record<string, unknown>;
  const projected = singleRow(snapshot, "GameRegistry");
  for (const field of ["preset_id", "start_main_at", "end_at", "seed"]) {
    if (BigInt(String(projected[field])) !== BigInt(String(game[field])))
      throw new Error("Herald game differs from shard");
  }
  const rules = singleRow(snapshot, "SliceRules");
  const chests = singleRow(snapshot, "ChestRules");
  return {
    presetId: ledgerInteger(String(game.preset_id)),
    start: ledgerInteger(String(game.start_main_at)),
    end: ledgerInteger(String(game.end_at)),
    seed: String(game.seed),
    dayUnit: ledgerInteger(String(rules.day_unit_seconds)),
    claimWindow: ledgerInteger(String(chests.claim_window_seconds)),
    chestPoolBps: ledgerInteger(String(chests.pool_bps)),
    topN: ledgerInteger(String(chests.top_n)),
  };
}

export async function fundFrontier(
  account: Account,
  provider: RpcProvider,
  shard: ShardConnection,
  heraldUrl: string,
  gameId: number,
  environment: "dev" | "production",
  amount: string,
) {
  const pool = depositWei(amount);
  const target = fundingTarget(environment);
  await assertProviderChain(account, target.network, "STARKNET_RPC");
  const { ledger, token } = target;
  const native = await readFrontierGame(provider, shard, heraldUrl, gameId);
  const presetId = frontierLedgerPresetId(environment, native.presetId);
  const head = await readConfirmedLedgerHead(account);
  const preset = decodeLedgerPreset(
    await account.callContract(
      {
        contractAddress: ledger,
        entrypoint: "get_preset",
        calldata: [String(presetId)],
      },
      head.number,
    ),
  );
  assertFrontierPreset(preset, native);
  if (head.time >= native.end) throw new Error("Frontier season has ended");
  const [lords] = await account.callContract(
    { contractAddress: ledger, entrypoint: "lords", calldata: [] },
    head.number,
  );
  if (!lords || BigInt(lords) !== BigInt(token)) throw new Error("Ledger token differs from environment address book");
  const submitted = await account.execute(
    buildFrontierFundingCalls(ledger, lords, {
      shard: shard.chainId,
      frontierSeasonId: gameId,
      presetId,
      start: native.start,
      end: native.end,
      seed: native.seed,
      pool,
    }),
  );
  const receipt = await account.waitForTransaction(submitted.transaction_hash);
  if (!("execution_status" in receipt) || receipt.execution_status !== "SUCCEEDED" || !("block_number" in receipt))
    throw new Error("Funding not confirmed");
  const frontier = await readFrontierFunding(account, ledger, { chainId: shard.chainId, gameId }, native);
  const prize = ((pool * BigInt(10_000 - native.chestPoolBps)) / 10_000n / 10n ** 18n) * 10n ** 18n;
  const chest = pool - prize;
  if (BigInt(frontier.pool) < chest || BigInt(frontier.prizePool) !== pool - chest)
    throw new Error("Frontier deposit differs from requested amount");
  return { chainId: shard.chainId, gameId, transactionHash: submitted.transaction_hash, frontier };
}

/** Close expired chest claims and move their remainder into the next funded season, atomically. */
export async function carryFrontier(
  account: Account,
  provider: RpcProvider,
  shard: ShardConnection,
  heraldUrl: string,
  previousGameId: number,
  gameId: number,
  environment: "dev" | "production",
) {
  if (
    !Number.isInteger(previousGameId) ||
    previousGameId <= 0 ||
    previousGameId > 0xffffffff ||
    previousGameId === gameId
  )
    throw new Error("Invalid previous game id");
  const { ledger, network } = fundingTarget(environment);
  await assertProviderChain(account, network, "STARKNET_RPC");
  const native = await readFrontierGame(provider, shard, heraldUrl, gameId);
  const head = await readConfirmedLedgerHead(account);
  const target = await readFrontierFunding(account, ledger, { chainId: shard.chainId, gameId }, native, head.number);
  const read = (entrypoint: string, calldata: string[]) =>
    account.callContract({ contractAddress: ledger, entrypoint, calldata }, head.number);
  const previous = decodeFrontierSeason(await read("get_frontier", [shard.chainId, String(previousGameId)]));
  const preset = decodeLedgerPreset(await read("get_preset", [String(previous.presetId)]));
  if (head.time < previous.end + preset.claimWindow) throw new Error("Previous chest claim window is open");
  if (target.closed || head.time >= target.end || target.start < previous.end)
    throw new Error("Invalid carry destination");
  const carry = await read("frontier_carry", [shard.chainId]);
  if (carry.length !== 2) throw new Error("Invalid carry balance");
  const amount =
    BigInt(ledgerU256(carry[0]!, carry[1]!)) + (previous.closed ? 0n : BigInt(previous.pool) - BigInt(previous.paid));
  if (previous.closed && amount === 0n) return { chainId: shard.chainId, gameId, frontier: target };
  const submitted = await account.execute([
    { contractAddress: ledger, entrypoint: "close_frontier", calldata: [shard.chainId, String(previousGameId)] },
    { contractAddress: ledger, entrypoint: "apply_frontier_carry", calldata: [shard.chainId, String(gameId)] },
  ]);
  const receipt = await account.waitForTransaction(submitted.transaction_hash);
  if (!("execution_status" in receipt) || receipt.execution_status !== "SUCCEEDED")
    throw new Error("Carry not confirmed");
  const frontier = await readFrontierFunding(account, ledger, { chainId: shard.chainId, gameId }, native);
  if (BigInt(frontier.pool) !== BigInt(target.pool) + amount || frontier.prizePool !== target.prizePool)
    throw new Error("Frontier carry readback differs");
  return { chainId: shard.chainId, gameId, transactionHash: submitted.transaction_hash, frontier };
}

function depositWei(amount: string) {
  if (!/^[1-9][0-9]*$/.test(amount)) throw new Error("Amount must be positive whole LORDS");
  const wei = BigInt(amount) * 10n ** 18n;
  if (wei >= 1n << 128n) throw new Error("Deposit must fit u128 wei");
  return wei;
}

function fundingTarget(environment: "dev" | "production") {
  if (environment !== "dev" && environment !== "production")
    throw new Error("Funding environment must be dev or production");
  const valueEnvironment = environment === "dev" ? "staging" : "production";
  return {
    ...environmentL2(valueEnvironment),
    ledger: valuePlaneAddress("ledger", valueEnvironment),
    token: valuePlaneAddress("lords", valueEnvironment),
  };
}

async function main() {
  const { getAccount } = await import("../../../../../scripts-runtime/js/starknet.js");
  const args = process.argv.slice(2);
  const carry = args[0] === "carry";
  if (carry) args.shift();
  const [environment, gameId, amount] = args;
  if ((environment !== "dev" && environment !== "production") || !gameId || !amount || args.length !== 3)
    throw new Error(
      "Usage: fund:frontier <dev|production> <game-id> <whole-lords> or carry:frontier <dev|production> <previous-game-id> <next-game-id>",
    );
  process.env.STARKNET_NETWORK = fundingTarget(environment).network;
  const manifest = readShardManifest<{ shard: { chainId: string }; world: { address: string } }>(
    process.env.NATIVE_WORLD_MANIFEST,
  );
  const rpcUrl = process.env.RPC_URL;
  if (!rpcUrl) throw new Error("RPC_URL is required");
  const heraldUrl = process.env.HERALD_URL;
  if (!heraldUrl) throw new Error("HERALD_URL is required");
  const shard = { rpcUrl, chainId: manifest.shard.chainId, gamesAddress: manifest.world.address };
  const account = await getAccount();
  const provider = new RpcProvider({ nodeUrl: rpcUrl });
  const result = carry
    ? await carryFrontier(account, provider, shard, heraldUrl, Number(gameId), Number(amount), environment)
    : await fundFrontier(account, provider, shard, heraldUrl, Number(gameId), environment, amount);
  console.log(JSON.stringify(result));
}

if (import.meta.main)
  main().catch(() => {
    // SDK errors can include signer configuration.
    console.error(
      "Frontier funding failed; check confirmed game, ledger preset, signer balance and transaction receipt.",
    );
    process.exitCode = 1;
  });
