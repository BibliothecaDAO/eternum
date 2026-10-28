import approved from "../../../config/source/frontier/extension.json";
import { CallData, shortString } from "starknet";
import {
  decodeFrontierSeason,
  decodeLedgerPreset,
  readConfirmedLedgerHead,
} from "../../../packages/value-ledger/src/codecs";
import { readShardAbi } from "../../../packages/value-ledger/src/shard-abi";
import { rpcAt } from "../../../packages/value-ledger/src/rpc";
import { valuePlaneAddress } from "../../../packages/chain/src/value-plane";
import { readConfirmedSnapshot, singleRow } from "./shard-snapshot";
import { ShardReader, type ShardConnection } from "./shard-rpc";

/** Confirm both approved identities before preparing a signer call or reconciling the calendar. */
export async function readFrontierExtension(connection: ShardConnection, heraldUrl: string, ledgerRpc: string) {
  const world = await readApprovedWorld(connection, heraldUrl);
  const ledger = await readApprovedLedger(ledgerRpc);
  if (
    world.time < approved.start ||
    ledger.head.time < approved.start ||
    world.time >= world.end ||
    ledger.head.time >= ledger.season.end
  )
    throw new Error("extension_not_live");
  return {
    chainId: approved.chainId,
    gameId: approved.gameId,
    start: approved.start,
    worldEnd: world.end,
    ledgerEnd: ledger.season.end,
    worldBlock: world.block,
    ledgerBlock: ledger.head.number,
    ledgerAddress: ledger.address,
    pool: ledger.season.pool,
    paid: ledger.season.paid,
    release: world.release,
  };
}

async function readApprovedWorld(connection: ShardConnection, heraldUrl: string) {
  if (BigInt(connection.chainId) !== BigInt(approved.chainId)) throw new Error("extension_chain_differs");
  const snapshot = await readConfirmedSnapshot(connection, heraldUrl, approved.gameId, [
    "GameRegistry",
    "GameRelease",
    "LordsBudget",
    "ChestRules",
    "SliceRules",
  ]);
  const reader = new ShardReader(connection);
  const shardHead = await reader.header(snapshot.confirmed_block);
  const provider = reader.provider();
  const abi = await readShardAbi(provider, connection.gamesAddress, snapshot.confirmed_block);
  const game = new CallData(abi).parse(
    "game",
    await provider.callContract(
      {
        contractAddress: connection.gamesAddress,
        entrypoint: "game",
        calldata: [String(approved.gameId)],
      },
      snapshot.confirmed_block,
    ),
  ) as Record<string, unknown>;
  const projected = singleRow(snapshot, "GameRegistry");
  for (const field of [
    "name",
    "preset_id",
    "start_settling_at",
    "start_main_at",
    "end_at",
    "end_grace_seconds",
    "seed",
  ])
    if (BigInt(String(game[field])) !== BigInt(String(projected[field])))
      throw new Error("extension_projection_differs");
  if (
    game.ready !== true ||
    game.settled !== false ||
    game.dev_mode_on !== false ||
    projected.ready !== true ||
    projected.settled !== false ||
    projected.dev_mode_on !== false
  )
    throw new Error("extension_game_not_live");
  const exact = (actual: unknown, expected: string | number) => BigInt(String(actual)) === BigInt(expected);
  if (
    !exact(game.name, shortString.encodeShortString(approved.name)) ||
    !exact(game.preset_id, approved.presetId) ||
    !exact(game.start_main_at, approved.start) ||
    !exact(game.start_settling_at, approved.start) ||
    !exact(game.end_grace_seconds, 0) ||
    !exact(game.seed, approved.seed) ||
    !exact(singleRow(snapshot, "SliceRules").day_unit_seconds, approved.dayUnit) ||
    !exact(singleRow(snapshot, "ChestRules").claim_window_seconds, approved.claimWindow) ||
    !exact(singleRow(snapshot, "LordsBudget").pool, approved.poolLords)
  )
    throw new Error("extension_game_identity_differs");
  const worldEnd = Number(game.end_at);
  const release = Number(singleRow(snapshot, "GameRelease").release_id);
  if (
    ![approved.oldEnd, approved.end].includes(worldEnd) ||
    (worldEnd === approved.end && release !== approved.release)
  )
    throw new Error("extension_world_end_differs");
  return { end: worldEnd, release, time: shardHead.timestamp, block: snapshot.confirmed_block };
}

async function readApprovedLedger(ledgerRpc: string) {
  const ledger = rpcAt(ledgerRpc);
  if (BigInt(await ledger.getChainId()) !== BigInt(shortString.encodeShortString("SN_MAIN")))
    throw new Error("extension_ledger_chain_differs");
  const head = await readConfirmedLedgerHead(ledger);
  const address = valuePlaneAddress("ledger", "production");
  const season = decodeFrontierSeason(
    await ledger.callContract(
      {
        contractAddress: address,
        entrypoint: "get_frontier",
        calldata: [approved.chainId, String(approved.gameId)],
      },
      head.number,
    ),
  );
  const preset = decodeLedgerPreset(
    await ledger.callContract(
      {
        contractAddress: address,
        entrypoint: "get_preset",
        calldata: [String(season.presetId)],
      },
      head.number,
    ),
  );
  if (
    season.closed ||
    season.start !== approved.start ||
    season.presetId !== approved.presetId ||
    BigInt(season.seed) !== BigInt(approved.seed) ||
    BigInt(season.pool) !== BigInt(approved.poolLords) * 10n ** 18n ||
    preset.dayUnit !== approved.dayUnit ||
    preset.claimWindow !== approved.claimWindow ||
    ![approved.oldEnd, approved.end].includes(season.end)
  )
    throw new Error("extension_ledger_identity_differs");
  return { season, head, address };
}

export function requireExtendedFrontier(proof: Awaited<ReturnType<typeof readFrontierExtension>>) {
  if (proof.worldEnd !== approved.end || proof.ledgerEnd !== approved.end)
    throw new Error("extension_not_confirmed_on_both_chains");
  return proof;
}
