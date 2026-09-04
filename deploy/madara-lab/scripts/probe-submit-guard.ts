#!/usr/bin/env bun
// Measures the client's submit path against a live lab game without a human login: a fresh gameplay account joins
// the game through the harness setup (settle, provision, explorers), then the client's own submission modules —
// configureGameplayAccountSubmits (local nonces) and EternumProvider's promise queue — fire a rapid burst across
// different armies and structures. Reports the wait from enqueue to sign+send per action (the same seam the client's
// explore_calls_built → explore_sign_send_started stages measure) and the on-chain outcome of every hash, so a
// stranded nonce shows up as a hash that never reaches a status.
//
//   bun deploy/madara-lab/scripts/probe-submit-guard.ts <gameId> [bursts=2] [account.json]
// The joined account's key is written next to the run so a later invocation can reuse it instead of taking a slot.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { writeFile } from "node:fs/promises";
import { Account, BlockTag, CallData, RpcProvider, logger, shortString, type Call } from "starknet";
import { EternumProvider, TransactionType } from "../../../packages/provider/src/index";
import { resolveGameTransactionResourceBounds } from "../../../packages/core/src/account/transaction-resource-bounds";
import { configureGameplayAccountSubmits } from "../../../apps/game/src/account/gameplay-account-submit";
import { createHarnessAccounts } from "../harness/account-factory";
import { parseStructureIds, type HarnessSystemAddresses } from "../harness/driver";
import { HeraldObserver } from "../harness/herald-observer";
import { buildBlitzSettleCalls } from "../../../apps/game/src/services/blitz/blitz-settlement-calls";

logger.setLogLevel("FATAL");

const REPOSITORY_ROOT = path.resolve(import.meta.dir, "../../..");
const RPC_URL = process.env.RPC_URL ?? "https://rpc.realms.party";
const HERALD_URL = process.env.HERALD_URL ?? "https://herald.realms.party";
const CLASS_HASH =
  process.env.PLAYER_ACCOUNT_CLASS_HASH ?? "0x05085c5c53efdc762c7c0637c92eecaf962aa3d72774b38faf3b8852c1729093";
const AUTHORITY =
  process.env.BINDING_AUTHORITY_ADDRESS ?? "0x008a1719e7ca19f3d91e8ef50a48fc456575f645497a1d55f30e3781f786afe4";
const WOOD_RESOURCE_ID = 1;
const STATUS_POLL_MS = 250;
const STATUS_TIMEOUT_MS = 30_000;

interface ActionSample {
  id: string;
  kind: "explore" | "produce";
  burst: number;
  independent: boolean;
  enqueuedAt: number;
  executeAt?: number;
  callsBuiltAt?: number;
  signSendStartedAt?: number;
  hash?: string;
  error?: string;
  status?: string;
}

interface WorldManifest {
  contracts: Array<{ address?: string; tag?: string }>;
}

const gameId = Number(process.argv[2]);
const bursts = Number(process.argv[3] ?? 2);
if (!Number.isInteger(gameId) || gameId <= 0) throw new Error("usage: probe-submit-guard.ts <gameId> [bursts]");

const manifest = JSON.parse(
  await readFile(path.join(REPOSITORY_ROOT, "contracts/l3/game/manifest_madara.json"), "utf8"),
) as WorldManifest;
const contract = (tag: string): string => {
  const found = manifest.contracts.find((candidate) => candidate.tag === tag)?.address;
  if (!found) throw new Error(`Manifest does not define ${tag}`);
  return found;
};
const systems: HarnessSystemAddresses = {
  blitzRealm: contract("s2-blitz_realm_systems"),
  prizeDistribution: contract("s2-prize_distribution_systems"),
  production: contract("s2-production_systems"),
  troopManagement: contract("s2-troop_management_systems"),
  troopMovement: contract("s2-troop_movement_systems"),
};

const rpc = new RpcProvider({ blockIdentifier: BlockTag.PRE_CONFIRMED, nodeUrl: RPC_URL });
const observer = new HeraldObserver(HERALD_URL, "madara");
const bounds = { resourceBounds: resolveGameTransactionResourceBounds("madara"), tip: 0 };
const EXPLORER_TROOP_AMOUNT = 10_000_000_000n;
const startedAt = performance.now();
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const sameFelt = (left: unknown, right: unknown): boolean => BigInt(left as string) === BigInt(right as string);

const waitForStatus = async (hash: string): Promise<string> => {
  const deadline = performance.now() + STATUS_TIMEOUT_MS;
  while (performance.now() < deadline) {
    try {
      const status = (await rpc.getTransactionStatus(hash)) as { finality_status?: string; execution_status?: string };
      if (status.finality_status && status.finality_status !== "RECEIVED") {
        return `${status.finality_status}/${status.execution_status ?? "?"}`;
      }
    } catch {
      // not yet known to the node
    }
    await sleep(STATUS_POLL_MS);
  }
  return "STRANDED(no status after 30 s)";
};
const executeAndSettle = async (account: Account, calls: Call[], label: string): Promise<string> => {
  const { transaction_hash } = await account.execute(calls, bounds);
  const status = await waitForStatus(transaction_hash);
  console.log(JSON.stringify({ event: "setup_tx", label, hash: transaction_hash, status }));
  return status;
};

interface ProbeAccountFile {
  address: string;
  gameId: number;
  privateKey: string;
}

const reuseFile = process.argv[4];
let account: Account;
if (reuseFile) {
  const saved = JSON.parse(await readFile(reuseFile, "utf8")) as ProbeAccountFile;
  if (saved.gameId !== gameId) throw new Error(`${reuseFile} belongs to game ${saved.gameId}`);
  account = new Account({ provider: rpc, address: saved.address, signer: saved.privateKey, cairoVersion: "1" });
} else {
  const [created] = await createHarnessAccounts({ authority: AUTHORITY, classHash: CLASS_HASH, count: 1, gameId, provider: rpc });
  if (!created) throw new Error("No gameplay account was created");
  account = created.account;
  const keyFile = path.join(process.cwd(), `probe-submit-guard-account-${gameId}.json`);
  await writeFile(keyFile, JSON.stringify({ address: created.address, gameId, privateKey: created.privateKey } as ProbeAccountFile, null, 2));
  console.log(JSON.stringify({ event: "account_ready", address: created.address, keyFile, ms: Math.round(performance.now() - startedAt) }));
  const settled = await executeAndSettle(
    account,
    buildBlitzSettleCalls({
      blitzSystemsAddress: systems.blitzRealm,
      signerAddress: account.address,
      usernameFelt: shortString.encodeShortString("probe-sg"),
      gameId,
      cosmeticTokenIds: [],
    }),
    "settle",
  );
  if (!settled.endsWith("SUCCEEDED")) throw new Error(`Settlement did not succeed: ${settled}`);
}

const settlementRows = await observer.waitForModelRows(
  gameId,
  ["BlitzSettlement"],
  (models) => models.get("BlitzSettlement")!.some((row) => sameFelt(row.player, account.address)),
  30_000,
);
const settlement = settlementRows.get("BlitzSettlement")!.find((row) => sameFelt(row.player, account.address))!;
const structureIds = parseStructureIds(settlement.structure_ids);

if (!reuseFile) {
  const provisioned = await executeAndSettle(
    account,
    structureIds.map((structureId) => ({
      contractAddress: systems.blitzRealm,
      entrypoint: "provision_realm",
      calldata: CallData.compile([gameId, structureId]),
    })),
    "provision",
  );
  if (!provisioned.endsWith("SUCCEEDED")) throw new Error(`Provision did not succeed: ${provisioned}`);
  const resourceRows = (
    await observer.waitForModelRows(
      gameId,
      ["Resource"],
      (models) => models.get("Resource")!.filter((row) => structureIds.some((id) => sameFelt(row.entity_id, id))).length === structureIds.length,
      30_000,
    )
  ).get("Resource")!;
  // A crowded settlement ring makes the outward spawn tile busy; try every direction until one spawns.
  for (const structureId of structureIds) {
    const row = resourceRows.find((candidate) => sameFelt(candidate.entity_id, structureId))!;
    const troopType = [row.KNIGHT_T1_BALANCE, row.PALADIN_T1_BALANCE, row.CROSSBOWMAN_T1_BALANCE].findIndex(
      (balance) => BigInt(balance as string) >= EXPLORER_TROOP_AMOUNT,
    );
    if (troopType < 0) throw new Error(`Structure ${structureId} has no funded T1 troop type`);
    let spawned = false;
    for (let direction = 0; direction < 6 && !spawned; direction += 1) {
      const status = await executeAndSettle(
        account,
        [
          {
            contractAddress: systems.troopManagement,
            entrypoint: "explorer_create",
            calldata: CallData.compile([gameId, structureId, troopType, 0, EXPLORER_TROOP_AMOUNT, direction]),
          },
        ],
        `explorer_create ${structureId} dir ${direction}`,
      );
      spawned = status.endsWith("SUCCEEDED");
    }
    if (!spawned) throw new Error(`Could not spawn an explorer for ${structureId}`);
  }
}

const explorers = (await observer.readExplorers(gameId)).filter((explorer) =>
  structureIds.some((id) => sameFelt(explorer.owner, id)),
);
if (explorers.length === 0) throw new Error("The account has no explorers in Herald");
const bot = {
  account,
  explorers: explorers.map((explorer) => ({ explorerId: explorer.explorerId, outwardDirection: 0 })),
  structures: structureIds.map((structureId) => ({ structureId })),
};
console.log(
  JSON.stringify({
    event: "bot_ready",
    explorers: bot.explorers.map((explorer) => explorer.explorerId),
    structures: structureIds,
    ms: Math.round(performance.now() - startedAt),
  }),
);

// The client's modules: sign+send is observed by wrapping the raw execute before the nonce dispenser takes it.
const samples: ActionSample[] = [];
const rawExecute = account.execute.bind(account);
const idsIn = (calls: Call | Call[]): Set<string> => {
  const list = Array.isArray(calls) ? calls : [calls];
  const ids = new Set<string>();
  for (const call of list) {
    for (const value of (call.calldata ?? []) as unknown[]) {
      try {
        ids.add(BigInt(value as string).toString());
      } catch {
        // non-numeric calldata member
      }
    }
  }
  return ids;
};
account.execute = ((calls: Call | Call[], details?: unknown) => {
  const now = performance.now();
  const ids = idsIn(calls);
  const sample = samples.find((candidate) => candidate.executeAt === undefined && ids.has(candidate.id));
  if (sample) sample.executeAt = now;
  return rawExecute(calls as never, details as never);
}) as typeof account.execute;
configureGameplayAccountSubmits(account, "madara");

const provider = new EternumProvider(manifest as never, RPC_URL, "0x0", undefined, {
  executionResourceBounds: resolveGameTransactionResourceBounds("madara"),
  gameId,
  namespace: "s2",
});
provider.on("transactionProgress", (payload: { stage?: string; explorerId?: unknown }) => {
  const explorerId = payload.explorerId === undefined ? undefined : BigInt(String(payload.explorerId)).toString();
  if (!explorerId) return;
  const sample = samples.findLast((candidate) => candidate.id === explorerId && candidate.signSendStartedAt === undefined);
  if (!sample) return;
  if (payload.stage === "explore_calls_built") sample.callsBuiltAt = performance.now();
  if (payload.stage === "explore_sign_send_started") sample.signSendStartedAt = performance.now();
});

const nextTick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const fireBurst = async (burst: number): Promise<void> => {
  const pending: Promise<unknown>[] = [];
  const pendingExplorers = new Set(samples.filter((s) => s.kind === "explore" && s.status === undefined).map((s) => s.id));
  for (const explorer of bot.explorers) {
    const id = BigInt(explorer.explorerId).toString();
    const sample: ActionSample = {
      id,
      kind: "explore",
      burst,
      independent: !pendingExplorers.has(id),
      enqueuedAt: performance.now(),
    };
    samples.push(sample);
    pending.push(
      provider
        .explorer_explore({ signer: account, explorer_id: Number(explorer.explorerId), directions: [explorer.outwardDirection] })
        .then((result: { transaction_hash?: string }) => {
          sample.hash = result?.transaction_hash;
        })
        .catch((error: unknown) => {
          sample.error = error instanceof Error ? error.message : String(error);
        }),
    );
    await nextTick();
  }
  for (const structure of bot.structures) {
    const id = BigInt(structure.structureId).toString();
    const sample: ActionSample = { id, kind: "produce", burst, independent: true, enqueuedAt: performance.now() };
    samples.push(sample);
    pending.push(
      provider.promiseQueue
        .enqueue<{ transaction_hash?: string }>({
          signer: account,
          calls: {
            contractAddress: systems.production,
            entrypoint: "burn_labor_for_resource_production",
            calldata: [structure.structureId, [1], [WOOD_RESOURCE_ID]],
          },
          transactionType: TransactionType.BURN_LABOR_FOR_RESOURCE_PRODUCTION,
        })
        .then((result) => {
          sample.hash = result?.transaction_hash;
        })
        .catch((error: unknown) => {
          sample.error = error instanceof Error ? error.message : String(error);
        }),
    );
    await nextTick();
  }
  await Promise.allSettled(pending);
};

const nonceBefore = BigInt(await account.getNonce(BlockTag.PRE_CONFIRMED));
for (let burst = 1; burst <= bursts; burst += 1) {
  await fireBurst(burst);
  await resolveStatuses();
  if (burst < bursts) await sleep(3_000);
}
const nonceAfter = BigInt(await account.getNonce(BlockTag.PRE_CONFIRMED));

async function resolveStatuses(): Promise<void> {
  const deadline = performance.now() + STATUS_TIMEOUT_MS;
  while (performance.now() < deadline) {
    const unresolved = samples.filter((sample) => sample.hash && !sample.status);
    if (unresolved.length === 0) return;
    await Promise.all(
      unresolved.map(async (sample) => {
        try {
          const status = (await rpc.getTransactionStatus(sample.hash!)) as {
            finality_status?: string;
            execution_status?: string;
          };
          if (status.finality_status && status.finality_status !== "RECEIVED") {
            sample.status = `${status.finality_status}/${status.execution_status ?? "?"}`;
          }
        } catch {
          // not yet known to the node
        }
      }),
    );
    await sleep(STATUS_POLL_MS);
  }
  for (const sample of samples) if (sample.hash && !sample.status) sample.status = "STRANDED(no status after 30 s)";
}

const quantile = (values: number[], q: number): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1)]!;
};
const waits = (filter: (sample: ActionSample) => boolean) =>
  samples.filter((s) => filter(s) && s.executeAt !== undefined).map((s) => s.executeAt! - s.enqueuedAt);
const stageWaits = samples
  .filter((s) => s.callsBuiltAt !== undefined && s.signSendStartedAt !== undefined)
  .map((s) => s.signSendStartedAt! - s.callsBuiltAt!);
const summarize = (values: number[]) => ({
  n: values.length,
  p50: quantile(values, 0.5),
  p95: quantile(values, 0.95),
  max: values.length ? Math.max(...values) : null,
});
console.log(
  JSON.stringify(
    {
      event: "submit_guard_probe",
      gameId,
      account: account.address,
      nonce: { before: nonceBefore.toString(), after: nonceAfter.toString(), consumed: (nonceAfter - nonceBefore).toString() },
      enqueueToSignSendMs: {
        independent: summarize(waits((s) => s.independent)),
        sameArmyRepeat: summarize(waits((s) => !s.independent)),
        all: summarize(waits(() => true)),
      },
      exploreCallsBuiltToSignSendMs: summarize(stageWaits),
      actions: samples.map((s) => ({
        burst: s.burst,
        kind: s.kind,
        id: s.id,
        independent: s.independent,
        waitMs: s.executeAt === undefined ? null : Math.round((s.executeAt - s.enqueuedAt) * 10) / 10,
        stageMs:
          s.callsBuiltAt !== undefined && s.signSendStartedAt !== undefined
            ? Math.round((s.signSendStartedAt - s.callsBuiltAt) * 10) / 10
            : null,
        hash: s.hash?.slice(0, 14),
        status: s.status ?? (s.error ? `ERROR: ${s.error.slice(0, 120)}` : "no hash"),
      })),
    },
    null,
    2,
  ),
);
process.exit(0);
