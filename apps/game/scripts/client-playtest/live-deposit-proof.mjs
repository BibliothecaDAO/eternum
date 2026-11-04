import { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { resolveExplorerTroops, staminaAt, troopStaminaLimits } from "@bibliothecadao/eternum/troop-stamina";
import { encodeNativeCommand, gameplayRejection } from "@bibliothecadao/provider";
import { RESOURCE_PRECISION, ResourcesIds } from "@bibliothecadao/types";
import { transaction } from "starknet";
import bindings from "../../../../contracts/l3/world-native/schema/bindings.json" with { type: "json" };

const MODELS = [
  "GameRegistry",
  "GameRelease",
  "SliceRules",
  "SettlementRules",
  "Structure",
  "TileOccupancy",
  "ExplorerTroops",
  "ArmySlot",
  "ArmyProgress",
  "ResourceBalance",
  "SpendLords",
  "LordsBudget",
  "LordsWithdrawal",
  "PrincipalWithdrawal",
];
const same = (a, b) => BigInt(a) === BigInt(b);
const insist = (condition, message) => {
  if (!condition) throw new Error(message);
};
const serial = (value) =>
  JSON.parse(JSON.stringify(value, (_, item) => (typeof item === "bigint" ? String(item) : item)));

/** Read-only evidence, kept on the existing step even when a prerequisite or a network read fails. */
export function liveDepositReads(owner, evidence, destination) {
  const cancelled = new AbortController();
  const stop = owner.onCancel(() => cancelled.abort());
  async function json(url, method, params) {
    owner.throwIfCancelled();
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.any([cancelled.signal, AbortSignal.timeout(10_000)]),
      ...(method
        ? {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
          }
        : {}),
    });
    const body = await response.text();
    evidence.responses.push({ url, method: method ?? "GET", params, status: response.status, body });
    insist(response.ok, `${method ?? url}: HTTP ${response.status}`);
    const parsed = JSON.parse(body);
    return method ? parsed : { result: parsed };
  }
  async function rpc(method, params) {
    const reply = await json(destination.rpcUrl, method, params);
    insist(!reply.error, `${method}: ${JSON.stringify(reply.error)}`);
    return reply.result;
  }
  async function verifyChain() {
    const chainId = await rpc("starknet_chainId", []);
    insist(same(chainId, destination.chainId), "RPC chain does not match the selected chain");
    return chainId;
  }
  async function snapshot(through = 0) {
    const url = new URL(`${destination.url.replace(/\/$/, "")}/games/${destination.gameId}/snapshot`);
    url.searchParams.set("models", MODELS.join(","));
    const body = await pollProof(
      owner,
      async () => {
        const snapshot = (await json(url.toString())).result;
        insist(!("preconfirmed_block" in snapshot), "Herald snapshot contains preconfirmed_block");
        return snapshot;
      },
      (body) => body.confirmed_block >= through,
      60_000,
      "Herald snapshot did not cover the confirmed receipt",
    );
    insist(same(body.game_id, destination.gameId), "Herald snapshot names another game");
    insist(Number.isSafeInteger(body.confirmed_block) && body.confirmed_block >= 0, "Snapshot has no confirmed block");
    const head = await rpc("starknet_getBlockWithTxHashes", { block_id: { block_number: body.confirmed_block } });
    insist(
      head.block_number === body.confirmed_block && Number.isSafeInteger(head.timestamp),
      "Snapshot head is not confirmed",
    );
    return { body, head };
  }
  async function receipt(hash) {
    const receipt = await pollProof(
      owner,
      async () => {
        const reply = await json(destination.rpcUrl, "starknet_getTransactionReceipt", { transaction_hash: hash });
        if (reply.error) {
          insist(reply.error.code === 29, `Receipt lookup: ${JSON.stringify(reply.error)}`);
          return null;
        }
        return reply.result;
      },
      (value) => value && Number.isSafeInteger(value.block_number),
      60_000,
      "No confirmed receipt for the UI action",
    );
    assertSuccessfulReceipt(receipt, destination, hash);
    return receipt;
  }
  async function receiptHead(receipt) {
    const head = await rpc("starknet_getBlockWithTxHashes", {
      block_id: { block_number: receipt.block_number },
    });
    insist(
      head.block_number === receipt.block_number &&
        same(head.block_hash, receipt.block_hash) &&
        Number.isSafeInteger(head.timestamp) &&
        head.transactions.some((hash) => same(hash, receipt.transaction_hash)),
      "Receipt transaction is not in its canonical confirmed block",
    );
    return head;
  }
  return { rpc, verifyChain, snapshot, receipt, receiptHead, stop };
}

export async function pollProof(owner, read, done, timeoutMs, missing) {
  const end = Date.now() + timeoutMs;
  do {
    owner.throwIfCancelled();
    const value = await read();
    if (done(value)) return value;
    await owner.sleep(500);
  } while (Date.now() < end);
  throw new Error(missing);
}

export function assertSuccessfulReceipt(receipt, destination, hash) {
  insist(same(receipt.transaction_hash, hash), "Receipt names another transaction");
  insist(Number.isSafeInteger(receipt.block_number) && receipt.block_number >= 0, "Receipt has no confirmed block");
  insist(["ACCEPTED_ON_L2", "ACCEPTED_ON_L1"].includes(receipt.finality_status), "Receipt is not confirmed");
  insist(
    receipt.execution_status === "SUCCEEDED",
    `Transaction failed: ${receipt.revert_reason ?? receipt.execution_status}`,
  );
  insist(Array.isArray(receipt.events), "Receipt has no event evidence");
  const scope = destination.actor ? { gameId: destination.gameId, actor: destination.actor } : undefined;
  const rejection = gameplayRejection(receipt.events, destination.worldAddress, hash, scope);
  insist(!rejection, `GameplayRejected: ${rejection?.reason || rejection?.statusClass}`);
}

/** The normal action records supply hashes; duplicate records for one send do not invent another transaction. */
export function newActionHashes(records, before) {
  const hashes = (rows) =>
    rows
      .map((record) => record.transactionHash)
      .filter(Boolean)
      .map((hash) => BigInt(hash));
  const prior = new Set(hashes(before));
  return [...new Set(hashes(records))].filter((hash) => !prior.has(hash)).map((hash) => `0x${hash.toString(16)}`);
}

export function assertOnlyRefillAction(records, before, hash) {
  const prior = new Set(before.map((record) => record.send?.key).filter(Boolean));
  const sent = records.filter((record) => record.send && !prior.has(record.send.key));
  insist(
    sent.length === 1 && sent[0].transactionHash && same(sent[0].transactionHash, hash),
    "Expected one completed refill send; an extra or unanswered action cannot count as proof",
  );
  insist(newActionHashes(records, before).length === 1, "More than one transaction appeared during refill proof");
}

/** Re-encode through the generated command ABI and Starknet's account encoder; compare the entire actual invocation. */
export function assertRefillTransaction(actual, receipt, destination, release, armyId, amount) {
  insist(
    actual.type === "INVOKE" && same(actual.sender_address, destination.actor),
    "Refill was not sent by the selected player",
  );
  insist(same(actual.transaction_hash, receipt.transaction_hash), "Transaction and receipt hashes differ");
  const command = encodeNativeCommand(bindings.commandAbi, {
    kind: "RefillStamina",
    value: { explorer_id: armyId, amount },
  });
  const expected = transaction.getExecuteCalldata(
    [
      {
        contractAddress: destination.worldAddress,
        entrypoint: "play",
        calldata: [
          String(destination.gameId),
          String(release.release_id),
          String(release.preset_commitment),
          String(command.length),
          ...command,
        ],
      },
    ],
    "1",
  );
  insist(
    actual.calldata?.length === expected.length && actual.calldata.every((felt, index) => same(felt, expected[index])),
    "Actual transaction must contain exactly one refill for the selected game/army and the visible amount",
  );
}

/** An offline fact store decodes the real response through the same generated native decoder as the client. */
export function refillState(snapshot, destination, armyId) {
  const store = new NativeFactStore();
  for (const model of MODELS) {
    const rows = snapshot.body.models.filter((entry) => entry.model === model);
    insist(rows.length === 1, `Snapshot must contain ${model} exactly once`);
    store.applyFacts(rows[0].rows.map((row) => ({ model, key: row.key, value: row.value })));
  }
  const game_id = destination.gameId;
  const explorer = store.require("ExplorerTroops", { game_id, explorer_id: BigInt(armyId) });
  const realm = store.require("Structure", { game_id, entity_id: explorer.owner });
  const actor = String(realm.owner);
  insist(!destination.actor || same(realm.owner, destination.actor), "Selected army is not owned by the player");
  store.setSnapshot({ gameId: game_id, actor, timestamp: snapshot.head.timestamp, complete: true });
  const purchased = store.require("SpendLords", { game_id, account: realm.owner });
  const earned = store.requireOrAbsent("ResourceBalance", {
    game_id,
    entity_id: explorer.owner,
    resource_type: ResourcesIds.Lords,
  });
  insist(earned.known, `Earned LORDS unavailable: ${earned.unknown}`);
  insist(earned.known.balance % BigInt(RESOURCE_PRECISION) === 0n, "Earned LORDS must be whole");
  const troops = resolveExplorerTroops(store, explorer);
  insist(troops, "Native army stamina is unavailable");
  const rules = store.require("SliceRules", { game_id });
  const maximum =
    troops.staminaMax ?? troopStaminaLimits(rules.troop_stamina_config, troops.category, troops.tier).staminaMax;
  const withdrawals = ["LordsWithdrawal", "PrincipalWithdrawal"]
    .flatMap((model) => [...store.inGame(model, game_id)].map((row) => ({ model, ...serial(row) })))
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return {
    actor,
    purchased,
    earned: earned.known.balance / BigInt(RESOURCE_PRECISION),
    troops,
    maximum,
    rules: rules.troop_stamina_config,
    tickSeconds: Number(rules.tick_config.armies_tick_in_seconds),
    budget: store.require("LordsBudget", { game_id }),
    withdrawals,
    release: store.require("GameRelease", { game_id }),
  };
}

export function assertVisiblePurse(visible, state) {
  insist(
    typeof visible?.spend === "string" &&
      /^\d+$/.test(visible.spend) &&
      typeof visible?.earned === "string" &&
      /^\d+$/.test(visible.earned),
    "Missing raw decimal purse balances",
  );
  insist(
    same(visible.spend, state.purchased.available) && same(visible.earned, state.earned),
    "Visible purse does not match the confirmed native balances",
  );
}

export function assertMixedRefill(visible, amount, missing) {
  insist(typeof amount === "string" && /^\d+$/.test(amount), "Missing actual UI refill amount");
  const p = BigInt(visible.spend),
    e = BigInt(visible.earned),
    q = BigInt(amount);
  insist(
    0n < p && p < q && q <= p + e && q < BigInt(missing),
    `Mixed partial refill requires 0 < purchased < amount <= purchased + earned and amount < missing stamina; P=${p}, E=${e}, q=${q}, missing=${missing}`,
  );
}

export function assertRefillConservation(before, after, amount, timestamp) {
  const q = BigInt(amount);
  const purchased = before.purchased.available < q ? before.purchased.available : q;
  const earned = q - purchased;
  insist(
    after.purchased.available === before.purchased.available - purchased &&
      after.purchased.consumed === before.purchased.consumed + purchased &&
      after.purchased.swept === before.purchased.swept &&
      after.earned === before.earned - earned,
    "Refill must debit purchased first, consume exactly that principal, and debit only the earned remainder",
  );
  insist(JSON.stringify(before.withdrawals) === JSON.stringify(after.withdrawals), "Refill changed withdrawals");
  insist(
    after.budget.pool_left === before.budget.pool_left + earned &&
      after.budget.pool === before.budget.pool &&
      after.budget.open === before.budget.open &&
      after.budget.day === before.budget.day,
    "Only the earned remainder may return to the reward pool; keep other players and day rollover outside this proof window",
  );
  insist(after.maximum === before.maximum, "Refill changed maximum stamina");
  const settled = staminaAt(before.troops, timestamp, before.rules, before.tickSeconds);
  insist(settled.amount + q < BigInt(before.maximum), "Refill was not partial at execution after regeneration");
  const actual = after.troops.stamina;
  insist(
    actual.amount === settled.amount + q &&
      actual.settled_at === timestamp &&
      actual.remainder === settled.remainder &&
      after.troops.boosts.incr_stamina_regen_seconds_left === settled.boostSecondsLeft,
    "Native stamina does not equal regenerated stamina plus the actual refill amount",
  );
  return serial({
    amount: q,
    purchasedDebit: purchased,
    earnedDebit: earned,
    before,
    after,
    receiptTimestamp: timestamp,
  });
}

/** The panel uses confirmed chain time. Bound regeneration by actual heads surrounding its read. */
export function visibleStaminaMatches(panel, state, from, through) {
  if (!panel || panel.maximum !== String(state.maximum) || !/^\d+$/.test(panel.current)) return false;
  const value = BigInt(panel.current);
  if (!Number.isSafeInteger(from) || !Number.isSafeInteger(through) || through < from || through - from > 60)
    return false;
  for (let second = from; second <= through; second++) {
    if (staminaAt(state.troops, second, state.rules, state.tickSeconds).amount === value) return true;
  }
  return false;
}

/** Preserve the wallet/relay response bodies as well as the explicit confirmed proof reads. */
export function watchDepositResponses(devTools, evidence) {
  const requests = new Map();
  const pending = [];
  const stop = devTools.onEvent(({ method, params }) => {
    if (method === "Network.requestWillBeSent") {
      let rpc;
      try {
        rpc = JSON.parse(params.request.postData ?? "null")?.method;
      } catch {
        return;
      }
      if (rpc?.startsWith("starknet_") || new URL(params.request.url).pathname === "/api/value/deposits")
        requests.set(params.requestId, { url: params.request.url, method: rpc ?? "GET" });
    }
    if (method !== "Network.loadingFinished" || !requests.has(params.requestId)) return;
    const request = requests.get(params.requestId);
    pending.push(
      devTools.send("Network.getResponseBody", { requestId: params.requestId }).then(
        ({ body, base64Encoded }) => {
          evidence.responses.push({ ...request, body: base64Encoded ? Buffer.from(body, "base64").toString() : body });
        },
        (error) => {
          evidence.responses.push({ ...request, error: error.message });
        },
      ),
    );
  });
  return async () => {
    stop();
    await Promise.all(pending);
  };
}
