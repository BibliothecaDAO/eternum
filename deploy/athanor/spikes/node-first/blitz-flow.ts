// Throwaway fixed-rate direct flow. Preserve offered work and every PRE_CONFIRMED receipt.
import { existsSync } from "node:fs";
import { RpcProvider } from "starknet";
import {
  args,
  load,
  save,
  required,
  loopback,
  now,
  ms,
  normalize,
  presign,
  percentile,
  type Fixture,
  type Player,
} from "./common";
import { waitForSuccess } from "../../../../config/deployer/clean/shared/declare";
import { mapWithConcurrency } from "../../harness/account-factory";

type SentAction = {
  hash: string;
  actor: string;
  game: number;
  offeredNs: string;
  sentNs: string;
  acknowledgedNs?: string;
  receiptNs?: string;
  receiptBlockNumber?: number;
  executionStatus?: string;
  submitError?: string;
  chainPosition?: number;
};
type Prepared = { hash: string; body: string; actor: string; game: number };
const pause = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, Math.max(0, milliseconds)));

async function observe(url: string, records: Map<string, SentAction>) {
  const socket = new WebSocket(url);
  let failure: string | null = null;
  let closing = false;
  await new Promise<void>((resolve, reject) => {
    socket.onopen = () =>
      socket.send(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "starknet_subscribeNewTransactionReceipts",
          params: { finality_status: ["PRE_CONFIRMED"] },
        }),
      );
    socket.onerror = () => {
      failure = "receipt socket error";
      reject(new Error(failure));
    };
    socket.onclose = () => {
      if (!closing) failure = "receipt socket closed";
    };
    socket.onmessage = (event) => {
      const at = now();
      try {
        const message = JSON.parse(String(event.data));
        if (message.error) {
          failure = "subscription rejected";
          reject(new Error(failure));
          return;
        }
        if (message.id === 1) {
          resolve();
          return;
        }
        const receipt = message.params?.result;
        if (!receipt?.transaction_hash) return;
        const row = records.get(normalize(receipt.transaction_hash));
        if (row && !row.receiptNs) {
          row.receiptNs = String(at);
          row.executionStatus = receipt.execution_status;
          row.receiptBlockNumber = receipt.block_number;
        }
      } catch {
        failure = "invalid receipt frame";
      }
    };
  });
  return {
    close: () => {
      closing = true;
      socket.close();
    },
    failure: () => failure,
  };
}

export function phaseStatistics(rows: SentAction[]) {
  const latency = rows.flatMap((row) => (row.receiptNs ? [ms(BigInt(row.receiptNs) - BigInt(row.sentNs))] : []));
  return {
    offered: rows.length,
    completed: latency.length,
    succeeded: rows.filter((row) => row.executionStatus === "SUCCEEDED" && !row.submitError).length,
    p50Ms: percentile(latency, 0.5),
    p95Ms: percentile(latency, 0.95),
    worstMs: latency.length ? Math.max(...latency) : null,
    timeouts: rows.filter((row) => !row.receiptNs && !row.submitError).length,
    refusals: rows.filter((row) => row.submitError).length,
    reverted: rows.filter((row) => row.executionStatus && row.executionStatus !== "SUCCEEDED").length,
    schedulerDelayP95Ms: percentile(
      rows.map((row) => ms(BigInt(row.sentNs) - BigInt(row.offeredNs))),
      0.95,
    ),
  };
}

type BlitzFixture = Fixture & { destroyCalldata: string[][] };
type Actor = { fixture: BlitzFixture; player: Player };
type ReceiptStream = Awaited<ReturnType<typeof observe>>;
type Submit = (signed: Prepared, offered: bigint, chainPosition?: number) => void;

export function steadyChainSchedule(seconds: number, chainLength: number) {
  if (chainLength !== 1 && chainLength !== 3) throw new Error("Chain length must be 1 or 3");
  const chains = Math.floor((20.3 * seconds) / chainLength);
  return Array.from({ length: chains }, (_, chain) =>
    Array.from({ length: chainLength }, (_, position) => ({
      actorIndex: chain % 96,
      payloadIndex: Math.floor(chain / 96) * chainLength + position,
      chainPosition: position + 1,
      offeredOffsetNs: BigInt(Math.round((chain * chainLength * 1e9) / 20.3)),
    })),
  ).flat();
}

async function warmBlitzActions(
  actors: Actor[],
  provider: RpcProvider,
  records: Map<string, SentAction>,
  submit: Submit,
  stream: ReceiptStream,
  out: string,
) {
  const coldStages: Record<string, ReturnType<typeof phaseStatistics>> = {};
  for (const entrypoint of ["create_building", "destroy_building"]) {
    const cold = await mapWithConcurrency(actors, 8, async ({ fixture: f, player }) => {
      const calldata = entrypoint === "create_building" ? f.playerCalldata : f.destroyCalldata;
      if (!calldata?.[player.botId]) throw new Error("Missing building calldata");
      return {
        ...(await presign({ ...f, entrypoint, playerCalldata: calldata }, player, provider, 0, 1, 1, 1)),
        actor: player.address,
        game: f.game!.id,
      };
    });
    records.clear();
    const coldStart = now();
    for (const signed of cold) submit(signed, coldStart);
    const coldDeadline = now() + 120000000000n;
    while (cold.some((p) => !records.get(p.hash)?.receiptNs) && now() < coldDeadline && !stream.failure())
      await pause(5);
    const coldRows = [...records.values()];
    coldStages[entrypoint] = phaseStatistics(coldRows);
    save(out + "-cold-" + entrypoint + ".json", {
      temperature: "COLD; excluded",
      mode: entrypoint + ";96 simultaneous real actions; four preset2 games",
      ...phaseStatistics(coldRows),
      actions: coldRows,
      streamError: stream.failure(),
    });
    if (phaseStatistics(coldRows).succeeded !== 96 || stream.failure()) throw new Error("Blitz cold wave incomplete");
    await mapWithConcurrency(cold, 8, (p) => waitForSuccess(provider, p.hash));
  }
  return coldStages;
}

async function presignSteadyFlow(
  actors: Actor[],
  provider: RpcProvider,
  seconds: number,
  rate: number,
  chainLength: number,
) {
  // Presign every offered action before the timer; do not gate steady offers on prior receipts.
  const perActor = Math.ceil((rate * seconds) / (96 * chainLength)) * chainLength;
  return await mapWithConcurrency(actors, 8, async ({ fixture: f, player }) => {
    const nonce = BigInt(await provider.getNonceForAddress(player.address, "pre_confirmed"));
    const signed: Prepared[] = [];
    for (let step = 0; step < perActor; step++) {
      const entrypoint = step % 2 === 0 ? "create_building" : "destroy_building";
      const playerCalldata = step % 2 === 0 ? f.playerCalldata : f.destroyCalldata;
      signed.push({
        ...(await presign({ ...f, entrypoint, playerCalldata }, player, provider, 0, 1, 1, 1, nonce + BigInt(step))),
        actor: player.address,
        game: f.game!.id,
      });
    }
    return signed;
  });
}

async function main() {
  const a = args([
    "fixture",
    "rpc-url",
    "ws-url",
    "out",
    "seconds",
    "rate",
    "burst-file",
    "ready-file",
    "chain-length",
  ]);
  const fixture = load<{ chainId: string; fixtures: (Fixture & { destroyCalldata: string[][] })[] }>(
    required(a.fixture, "fixture"),
  );
  if (
    fixture.fixtures.length !== 4 ||
    fixture.fixtures.some((f) => f.players.length !== 24 || f.game?.kind !== "Blitz")
  )
    throw new Error("Four 24-player Blitz fixtures required");
  const actors = fixture.fixtures.flatMap((f) => f.players.map((player) => ({ fixture: f, player })));
  if (new Set(actors.map((a) => a.player.address)).size !== 96) throw new Error("Distinct Blitz accounts required");
  const url = loopback(required(a["rpc-url"], "rpc-url"));
  const provider = new RpcProvider({ nodeUrl: url });
  if (BigInt(await provider.getChainId()) !== BigInt(fixture.chainId)) throw new Error("Trial chain mismatch");
  const rate = Number(a.rate ?? 20.3),
    seconds = Number(a.seconds ?? 180);
  if (rate !== 20.3 || !Number.isFinite(seconds) || seconds < 120 || seconds > 600)
    throw new Error("Fixed 20.3/s; duration 120..600s");
  const chainLength = Number(a["chain-length"] ?? 1);
  const schedule = steadyChainSchedule(seconds, chainLength);
  const records = new Map<string, SentAction>();
  const stream = await observe(required(a["ws-url"], "ws-url"), records);
  try {
    const out = required(a.out, "out");
    let pending = new Set<Promise<void>>();
    const submit = (signed: Prepared, offered: bigint, chainPosition?: number) => {
      const sent = now();
      const row: SentAction = {
        hash: signed.hash,
        actor: signed.actor,
        game: signed.game,
        offeredNs: String(offered),
        sentNs: String(sent),
        chainPosition,
      };
      records.set(signed.hash, row);
      const request = (async () => {
        try {
          const response = await fetch(url, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: signed.body,
            signal: AbortSignal.timeout(120000),
          });
          const result = await response.json();
          row.acknowledgedNs = String(now());
          if (result.error || normalize(result.result?.transaction_hash ?? "0x0") !== signed.hash)
            row.submitError = "node refused or returned a different hash";
        } catch {
          row.submitError = "addInvoke round trip failed";
        }
      })();
      pending.add(request);
      void request.finally(() => pending.delete(request));
    };
    const coldStages = await warmBlitzActions(actors, provider, records, submit, stream, out);
    const payloads = await presignSteadyFlow(actors, provider, seconds, rate, chainLength);
    records.clear();
    const started = now();
    const deadline = started + BigInt(Math.ceil(seconds * 1e9));
    if (a["ready-file"]) save(a["ready-file"], { startedNs: String(started), rate, seconds });
    let burst: { firstSendNs: string; lastReceiptNs: string; completed: number } | null = null;
    for (const slot of schedule) {
      const offered = started + slot.offeredOffsetNs;
      if (slot.chainPosition === 1) await pause(ms(offered - now()));
      if (stream.failure()) break;
      if (a["burst-file"] && existsSync(a["burst-file"])) {
        burst = load(a["burst-file"]);
        if (burst && burst.completed !== 2000) throw new Error("Mixed burst incomplete; no passing small-game gate");
      }
      const finish = burst ? BigInt(burst.lastReceiptNs) + 30000000000n : deadline;
      if (now() >= finish) break;
      submit(payloads[slot.actorIndex]![slot.payloadIndex]!, offered, slot.chainPosition);
    }
    if (!burst) await pause(ms(deadline - now()));
    await Promise.all(pending);
    const receiptDeadline = now() + 120000000000n;
    while (
      [...records.values()].some((row) => !row.receiptNs && !row.submitError) &&
      now() < receiptDeadline &&
      !stream.failure()
    )
      await pause(10);
    const rows = [...records.values()];
    const subset = (begin: bigint, end: bigint) =>
      rows.filter((row) => BigInt(row.sentNs) >= begin && BigInt(row.sentNs) < end);
    const phases = burst
      ? {
          before: phaseStatistics(subset(started, BigInt(burst.firstSendNs))),
          duringBurst: phaseStatistics(subset(BigInt(burst.firstSendNs), BigInt(burst.lastReceiptNs))),
          afterLastReceipt30s: phaseStatistics(
            subset(BigInt(burst.lastReceiptNs), BigInt(burst.lastReceiptNs) + 30000000000n),
          ),
        }
      : { alone: phaseStatistics(rows) };
    save(out, {
      chainId: fixture.chainId,
      mode: "genuine alternating build/demolish per home; four preset2 Blitz games; separate accounts fromburst",
      rate,
      chainLength,
      chainPositionStats: Array.from({ length: chainLength }, (_, position) => ({
        position: position + 1,
        ...phaseStatistics(rows.filter((row) => row.chainPosition === position + 1)),
      })),
      seconds,
      startedNs: String(started),
      finishedNs: String(now()),
      burst,
      phases,
      quietFirst120Seconds: phaseStatistics(subset(started, started + 120000000000n)),
      coldStages,
      stats: phaseStatistics(rows),
      actions: rows,
      streamError: stream.failure(),
      coldEvidence: [out + "-cold-create_building.json", out + "-cold-destroy_building.json"],
    });
    console.log(JSON.stringify({ mode: "Blitz four by24", rate, phases, streamError: stream.failure() }));
    if (
      phaseStatistics(rows).succeeded !== rows.length ||
      stream.failure() ||
      (a["burst-file"] && (!burst || BigInt(burst.firstSendNs) < started + 120000000000n))
    )
      process.exitCode = 1;
  } finally {
    stream.close();
  }
}
if (import.meta.main)
  main().catch(() => {
    console.error("Blitz flow failed; no credentials emitted");
    process.exitCode = 1;
  });
