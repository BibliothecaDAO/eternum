import { gameplayRejection } from "@bibliothecadao/provider";

import { nodeRpc } from "./node-rpc.mjs";

const RECEIPT_WAIT_MS = 60_000;
const RECEIPT_POLL_MS = 1_000;
const NOT_FOUND = 29;
const CONFIRMED = ["ACCEPTED_ON_L2", "ACCEPTED_ON_L1"];

export const SENT_ACTIONS = `JSON.stringify((globalThis.__clientActionLatencyMeasurements ?? [])
  .filter(({ transactionHash }) => transactionHash)
  .map(({ operation, transactionHash }) => ({ operation, hash: transactionHash })))`;

export function sentSince(before, now) {
  const seen = new Set(before.map(({ hash }) => BigInt(hash)));
  return now.filter(({ hash }) => {
    const key = BigInt(hash);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function gameShardOf(browser) {
  const route = browser.read("JSON.stringify(location.pathname)");
  const match = /^\/g\/(0x[0-9a-f]+)\/(\d+)(\/|$)/i.exec(route);
  if (!match) throw new Error(`The page is not in a game: ${route}`);
  const directory = browser.read(`(async () => {
    const response = await fetch('/api/directory');
    return JSON.stringify({ status: response.status, body: await response.text() });
  })()`);
  if (directory.status !== 200) throw new Error(`The directory answered ${directory.status}`);
  const { shard } = JSON.parse(directory.body);
  if (!shard?.manifest || BigInt(shard.chainId) !== BigInt(match[1]))
    throw new Error(`The directory lists no shard for ${match[1]}`);
  return {
    chainId: match[1],
    gameId: Number(match[2]),
    rpcUrl: shard.manifest.rpcUrl,
    games: shard.manifest.contracts.games,
  };
}

export async function receiptsOf(owner, shard, actions) {
  const receipts = [];
  for (const action of actions)
    receipts.push(judgeReceipt(action, await readReceipt(owner, shard, action.hash), shard));
  return receipts;
}

export const allApplied = (receipts) => receipts.length > 0 && receipts.every(({ applied }) => applied);

async function readReceipt(owner, shard, hash) {
  const end = Date.now() + RECEIPT_WAIT_MS;
  let seen = null;
  while (Date.now() < end) {
    owner.throwIfCancelled();
    const reply = await nodeRpc(shard.rpcUrl, "starknet_getTransactionReceipt", { transaction_hash: hash });
    if (reply.error && reply.error.code !== NOT_FOUND)
      throw new Error(`Receipt of ${hash}: ${JSON.stringify(reply.error)}`);
    if (Number.isSafeInteger(reply.result?.block_number)) seen = reply.result;
    if (seen && (CONFIRMED.includes(seen.finality_status) || seen.execution_status === "REVERTED")) return seen;
    await owner.sleep(RECEIPT_POLL_MS);
  }
  return seen;
}

function judgeReceipt(action, receipt, shard) {
  if (!receipt) return { ...action, applied: false, why: "no confirmed receipt" };
  const rejection = gameplayRejection(receipt.events ?? [], shard.games, action.hash);
  const confirmed = CONFIRMED.includes(receipt.finality_status);
  const succeeded = receipt.execution_status === "SUCCEEDED";
  return {
    ...action,
    block: receipt.block_number,
    finality: receipt.finality_status,
    execution: receipt.execution_status,
    rejection: rejection ?? null,
    l2Gas: Number(receipt.execution_resources?.l2_gas ?? NaN),
    events: receipt.events?.length ?? 0,
    applied: confirmed && succeeded && !rejection,
    why: rejection
      ? `refused: ${rejection.reason || rejection.statusClass}`
      : (receipt.revert_reason ?? (confirmed ? null : `not confirmed: ${receipt.finality_status}`)),
  };
}
