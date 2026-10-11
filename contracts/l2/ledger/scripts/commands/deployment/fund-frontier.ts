#!/usr/bin/env bun
import { CallData, RpcProvider, type Account, type Abi } from "starknet";
import { getAccount } from "../../../../../scripts-runtime/js/starknet.js";
import { loadJsonConfigFile, requireAddressConfigValue } from "../../../../../scripts-runtime/js/config.js";
import { readShardManifest } from "../../../../../../packages/chain/shard-manifest.js";
import { assertProviderChain } from "../../../../../../packages/chain/chain-guard.js";
import {
  decodeLedgerPreset,
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

async function readFrontierGame(provider: RpcProvider, shard: ShardConnection, heraldUrl: string, gameId: number) {
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
    pool: String(chests.pool),
    dayUnit: ledgerInteger(String(rules.day_unit_seconds)),
    claimWindow: ledgerInteger(String(chests.claim_window_seconds)),
  };
}

export async function fundFrontier(
  account: Account,
  provider: RpcProvider,
  ledger: string,
  shard: ShardConnection,
  heraldUrl: string,
  gameId: number,
  network: "mainnet" | "sepolia",
) {
  const native = await readFrontierGame(provider, shard, heraldUrl, gameId);
  const presetId = frontierLedgerPresetId(network, native.presetId);
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
  if (!lords || BigInt(lords) === 0n) throw new Error("Ledger LORDS token unavailable");
  const pool = BigInt(native.pool) * 10n ** 18n;
  const submitted = await account.execute(
    buildFrontierFundingCalls(ledger, lords, {
      shard: shard.chainId,
      frontierSeasonId: gameId,
      presetId,
      start: native.start,
      seed: native.seed,
      pool,
    }),
  );
  const receipt = await account.waitForTransaction(submitted.transaction_hash);
  if (!("execution_status" in receipt) || receipt.execution_status !== "SUCCEEDED" || !("block_number" in receipt))
    throw new Error("Funding not confirmed");
  const frontier = await readFrontierFunding(account, ledger, { chainId: shard.chainId, gameId }, native);
  return { chainId: shard.chainId, gameId, transactionHash: submitted.transaction_hash, frontier };
}

async function main() {
  const [network, gameId] = process.argv.slice(2);
  if ((network !== "mainnet" && network !== "sepolia") || !gameId || process.argv.length !== 4)
    throw new Error("Usage: fund:frontier <mainnet|sepolia> <game-id>");
  process.env.STARKNET_NETWORK = network;
  const manifest = readShardManifest<{ shard: { chainId: string }; world: { address: string } }>(
    process.env.NATIVE_WORLD_MANIFEST,
  );
  const addresses = loadJsonConfigFile(new URL(`../../../../../common/addresses/${network}.json`, import.meta.url));
  const ledger = requireAddressConfigValue(addresses.ledger, "Address book ledger");
  if (BigInt(ledger) === 0n) throw new Error("Ledger is not deployed");
  const rpcUrl = process.env.RPC_URL;
  if (!rpcUrl) throw new Error("RPC_URL is required");
  const heraldUrl = process.env.HERALD_URL;
  if (!heraldUrl) throw new Error("HERALD_URL is required");
  const shard = { rpcUrl, chainId: manifest.shard.chainId, gamesAddress: manifest.world.address };
  const result = await fundFrontier(
    await getAccount(),
    new RpcProvider({ nodeUrl: rpcUrl }),
    ledger,
    shard,
    heraldUrl,
    Number(gameId),
    network,
  );
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
