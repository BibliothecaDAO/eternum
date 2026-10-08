import { Worker } from "node:worker_threads";
import { resolve } from "node:path";
import { RpcProvider } from "starknet";
import { mapWithConcurrency } from "../../harness/account-factory";
import {
  args,
  required,
  load,
  save,
  loopback,
  trialDirectory,
  now,
  ms,
  percentile,
  presign,
  storageSlot,
  normalize,
  type Fixture,
} from "./common";
import { settledHomes, settleCloseFootprint } from "./settlement";
import { discoveryFacts } from "./discovery";
import { cpu, metricCounters, executorLogs, textLength } from "./telemetry";

type ObservedReceipt = {
  at: bigint;
  status: string;
  blockNumber?: number;
  discovery?: ReturnType<typeof discoveryFacts>;
};
async function subscribe(url: string, received: Map<string, ObservedReceipt>, heads: number[], fixture: Fixture) {
  const socket = new WebSocket(url);
  let failure: string | null = null;
  await new Promise<void>((ok, bad) => {
    socket.onopen = () => {
      socket.send(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "starknet_subscribeNewTransactionReceipts",
          params: { finality_status: ["PRE_CONFIRMED"] },
        }),
      );
      socket.send(JSON.stringify({ jsonrpc: "2.0", id: 2, method: "starknet_subscribeNewHeads", params: {} }));
    };
    socket.onerror = () => {
      failure = "receipt socket error";
      bad(new Error(failure));
    };
    const ready = new Set<number>();
    socket.onmessage = (event) => {
      const at = now();
      try {
        const p = JSON.parse(String(event.data));
        if (p.error) {
          failure = "subscription rejected";
          bad(new Error(failure));
          return;
        }
        if (p.id) {
          ready.add(p.id);
          if (ready.has(1) && ready.has(2)) ok();
          return;
        }
        const value = p.params?.result;
        if (value?.transaction_hash && !received.has(normalize(value.transaction_hash)))
          received.set(normalize(value.transaction_hash), {
            at,
            status: value.execution_status,
            blockNumber: value.block_number,
            discovery:
              fixture.game?.kind === "Explore"
                ? discoveryFacts(value.events ?? [], fixture.contract, fixture.game.id)
                : undefined,
          });
        if (value?.block_number !== undefined && !value.transaction_hash) heads.push(value.block_number);
      } catch {
        failure = "invalid receipt frame";
      }
    };
    socket.onclose = () => {
      failure = "receipt socket closed";
    };
    setTimeout(() => {
      if (ready.size < 2) bad(new Error("subscription timeout"));
    }, 10000).unref();
  });
  return { close: () => socket.close(), failure: () => failure };
}
export async function burst(
  url: string,
  payloads: { hash: string; body: string }[],
  count: number,
  before: () => void,
) {
  const barrier = new SharedArrayBuffer(4);
  const gate = new Int32Array(barrier);
  const width = Math.ceil(payloads.length / count);
  const jobs = Array.from({ length: count }, (_, i) => payloads.slice(i * width, (i + 1) * width))
    .filter((p) => p.length)
    .map((group) => {
      const worker = new Worker(new URL("./send-worker.ts", import.meta.url), {
        workerData: { url, payloads: group, barrier },
      });
      let rows: { hash: string; sentNs: string; error: string | null }[] | undefined;
      let ready!: () => void;
      let failReady!: (error: Error) => void;
      const initialized = new Promise<void>((ok, bad) => {
        ready = ok;
        failReady = bad;
      });
      const finished = new Promise<typeof rows>((ok, bad) => {
        worker.on("message", (value) => {
          if (value.ready) ready();
          if (value.rows) rows = value.rows;
          if (value.failed) {
            failReady(new Error("sender failed"));
            bad(new Error("sender failed"));
          }
        });
        worker.on("error", (error) => {
          failReady(error);
          bad(error);
        });
        worker.on("exit", (code) => (code === 0 && rows ? ok(rows) : bad(new Error("sender did not finish cleanly"))));
      });
      finished.catch(() => {});
      return { worker, initialized, finished };
    });
  try {
    await Promise.all(jobs.map((j) => j.initialized));
    before();
    Atomics.store(gate, 0, 1);
    Atomics.notify(gate, 0);
    return (await Promise.all(jobs.map((j) => j.finished))).flatMap((v) => v ?? []);
  } finally {
    await Promise.all(jobs.map((j) => j.worker.terminate()));
  }
}
async function main() {
  const a = args([
    "fixture",
    "rpc-url",
    "ws-url",
    "out",
    "arms",
    "work",
    "workers",
    "node-pid",
    "node-log",
    "node-metrics",
    "node-image",
    "timeout-ms",
    "warm-ms",
    "receipt-checkpoint",
  ]);
  const out = trialDirectory(required(a.out, "out"));
  const fixture = load<Fixture>(required(a.fixture, "fixture"));
  const url = loopback(required(a["rpc-url"], "rpc-url"));
  const provider = new RpcProvider({ nodeUrl: url });
  if (BigInt(await provider.getChainId()) !== BigInt(fixture.chainId)) throw new Error("Trial chain mismatch");
  const [writes, hashes] = (a.work ?? "32:256").split(":").map(Number);
  if (!writes || !hashes || writes > 128 || hashes > 4096 || writes * hashes > 65536)
    throw new Error("Invalid work size");
  const workers = Number(a.workers ?? 8);
  const nodePid = Number(required(a["node-pid"], "node-pid"));
  if (!Number.isInteger(workers) || workers < 1 || workers > 32 || !Number.isInteger(nodePid) || nodePid < 1)
    throw new Error("Invalid workers/PID");
  const arms = (a.arms ?? fixture.game?.arm ?? "X,Y").split(",");
  if (arms.some((arm) => !["X", "Y"].includes(arm))) throw new Error("Arm X or Y required");
  for (const [index, arm] of arms.entries()) {
    const run = Date.now() + index;
    const file = resolve(out, `${run}-${arm}-${writes}x${hashes}.json`);
    let sampler: ReturnType<typeof cpu> | undefined;
    let stream: Awaited<ReturnType<typeof subscribe>> | undefined;
    const header = {
      tier: fixture.game ? 2 : 1,
      game: fixture.game,
      arm,
      run,
      writes,
      hashes,
      accounts: fixture.players.length,
      nodeImage: required(a["node-image"], "node-image"),
      chainId: fixture.chainId,
      contract: fixture.contract,
      classHash: fixture.classHash,
      visibleDefinition: "first PRE_CONFIRMED receipt arrival at the subscribed observer",
      status: "preparing",
      passed: false,
    };
    save(file, header);
    try {
      if (fixture.game?.kind === "Settle") {
        const empty = await settledHomes(provider, fixture);
        if (empty.homes !== 0 || empty.aggregateRealmCount !== 0) throw new Error("Settle fixture is not empty");
      }
      // One real probe before the window warms the new class. Its nonce is consumed and reread before presigning the wave.
      const warm = await presign(fixture, fixture.players[0]!, provider, run - 1, arm === "X" ? 0 : 1, writes, hashes);
      const response = await fetch(fixture.simulationRpc ?? url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: fixture.simulationRpc
          ? JSON.stringify({
              jsonrpc: "2.0",
              id: 1,
              method: "starknet_simulateTransactions",
              // Simulation otherwise charges fees despite the trial node's --no-charge-fee mode.
              params: ["pre_confirmed", [JSON.parse(warm.body).params[0]], ["SKIP_FEE_CHARGE"]],
            })
          : warm.body,
      });
      const warmResult = await response.json();
      if (
        warmResult.error ||
        (fixture.simulationRpc &&
          warmResult.result?.[0]?.transaction_trace?.execute_invocation?.revert_reason !== undefined)
      )
        throw new Error("warmup submit or simulation execution failed");
      if (!fixture.simulationRpc) await provider.waitForTransaction(warm.hash);
      await new Promise((ok) => setTimeout(ok, Number(a["warm-ms"] ?? 15000)));
      const payloads = await mapWithConcurrency(fixture.players, 32, (p) =>
        presign(fixture, p, provider, run, arm === "X" ? 0 : 1, writes, hashes),
      );
      const before = fixture.game?.kind === "Explore" ? await exploreState(provider, fixture) : null;
      const received = new Map<string, ObservedReceipt>();
      const heads: number[] = [];
      stream = await subscribe(required(a["ws-url"], "ws-url"), received, heads, fixture);
      let metricsBefore = metricCounters(a["node-metrics"]);
      let logOffset = textLength(a["node-log"]);
      const rows = await burst(url, payloads, workers, () => {
        heads.length = 0;
        metricsBefore = metricCounters(a["node-metrics"]);
        logOffset = textLength(a["node-log"]);
        sampler = cpu(nodePid);
      });
      const sent = rows.map((r) => BigInt(r.sentNs));
      const first = sent.reduce((a, b) => (a < b ? a : b));
      const lastSend = sent.reduce((a, b) => (a > b ? a : b));
      const deadline = now() + BigInt(Number(a["timeout-ms"] ?? 90000)) * 1_000_000n;
      while (payloads.some((p) => !received.has(p.hash)) && now() < deadline && !stream.failure())
        await new Promise((ok) => setTimeout(ok, 10));
      const nodeCpu = sampler!.finish();
      sampler = undefined;
      const executionEvidence = executorLogs(a["node-log"], logOffset);
      const burstHeads = [...heads];
      const actions = rows.map((row) => ({
        hash: row.hash,
        sentNs: row.sentNs,
        sendMs: ms(BigInt(row.sentNs) - first),
        receiptMs: received.has(row.hash) ? ms(received.get(row.hash)!.at - first) : null,
        executionStatus: received.get(row.hash)?.status ?? null,
        receiptBlockNumber: received.get(row.hash)?.blockNumber ?? null,
        submitError: row.error,
        discovery: received.get(row.hash)?.discovery,
      }));
      const succeeded = actions.filter((row) => row.executionStatus === "SUCCEEDED" && !row.submitError);
      const latencies = actions.flatMap((row) => (row.receiptMs === null ? [] : [row.receiptMs]));
      const complete = succeeded.length === payloads.length;
      if (a["receipt-checkpoint"])
        save(a["receipt-checkpoint"], {
          firstSendNs: String(first),
          lastReceiptNs: complete
            ? String(
                succeeded.reduce((last, row) => {
                  const at = received.get(row.hash)!.at;
                  return at > last ? at : last;
                }, first),
              )
            : null,
          completed: succeeded.length,
        });
      const lastVisibleMs = complete ? Math.max(...latencies) : null;
      const spreadMs = ms(lastSend - first);
      const releaseValid = spreadMs < 100;
      // Let the existing collector flush counters; this wait is outside the reported visibility window.
      await new Promise((ok) => setTimeout(ok, 16000));
      const metricsAfter = metricCounters(a["node-metrics"]);
      const deltas = Object.fromEntries(
        Object.entries(metricsAfter.values).map(([name, value]) => [
          name,
          metricsBefore.values[name] === undefined ? null : value - metricsBefore.values[name]!,
        ]),
      );
      const sharedCounter = fixture.game ? null : storageSlot("counters", 1, run);
      const sharedHead = fixture.game ? null : storageSlot("heads", 1, run);
      const counter = fixture.game
        ? (
            await provider.callContract(
              { contractAddress: fixture.contract, entrypoint: "entity_counter", calldata: [fixture.game.id] },
              "pre_confirmed",
            )
          )[0]!
        : await provider.getStorageAt(fixture.contract, sharedCounter!, "pre_confirmed");
      const discovery =
        fixture.game?.kind === "Explore"
          ? {
              reveals: succeeded.reduce((n, row) => n + (row.discovery?.ExpeditionDiscovery ?? 0), 0),
              ruins: succeeded.reduce((n, row) => n + (row.discovery?.SiteChest ?? 0), 0),
              budgetWrites: succeeded.reduce((n, row) => n + (row.discovery?.LordsBudget ?? 0), 0),
              structuresAllocated: succeeded.reduce((n, row) => n + (row.discovery?.Structure ?? 0), 0),
              before,
              after: await exploreState(provider, fixture),
            }
          : null;
      const settlement = fixture.game?.kind === "Settle" ? await settledHomes(provider, fixture) : null;
      let footprint =
        fixture.game?.kind === "Settle" ? settleCloseFootprint(a["node-log"], logOffset, payloads.length) : null;
      const closeDeadline = now() + 60_000_000_000n;
      while (footprint && !footprint.complete && !footprint.contaminated && now() < closeDeadline) {
        await new Promise((ok) => setTimeout(ok, 1000));
        footprint = settleCloseFootprint(a["node-log"], logOffset, payloads.length);
      }
      const expectedCounter = fixture.game
        ? fixture.game.initialCounter +
          (fixture.game.arm === "X" ? (discovery?.structuresAllocated ?? payloads.length) : 0)
        : arm === "X"
          ? payloads.length
          : 0;
      const counterValid = BigInt(counter) === BigInt(expectedCounter);
      const discoveryValid =
        discovery === null ||
        (discovery.reveals === succeeded.length &&
          discovery.ruins === discovery.budgetWrites &&
          discovery.before?.day[0] === "0" &&
          discovery.after.day[0] === "0");
      save(file, {
        ...header,
        status: "finished",
        passed:
          counterValid &&
          discoveryValid &&
          (settlement?.valid ?? true) &&
          (footprint?.complete ?? true) &&
          complete &&
          releaseValid &&
          !stream.failure() &&
          lastVisibleMs! < 5000,
        firstSendNs: first.toString(),
        sendSpreadMs: spreadMs,
        releaseValid,
        completed: succeeded.length,
        lastVisibleMs,
        p50Ms: percentile(latencies, 0.5),
        p95Ms: percentile(latencies, 0.95),
        stretch: complete && releaseValid && lastVisibleMs! < 2000,
        streamError: stream.failure(),
        sharedSlots: { counter: sharedCounter, head: sharedHead, counterValue: counter, valid: counterValid },
        actions,
        discovery: discovery
          ? { ...discovery, ruinRate: discovery.reveals ? discovery.ruins / discovery.reveals : null }
          : undefined,
        settlement,
        settleCloseFootprint: footprint,
        nodeCpu,
        node: {
          ...executionEvidence,
          headsObserved: burstHeads,
          metricDeltas: deltas,
          unavailableMetrics: metricsAfter.missing,
        },
      });
      console.log(JSON.stringify({ result: file, arm, lastVisibleMs, sendSpreadMs: spreadMs, complete }));
    } catch {
      save(file, {
        ...header,
        status: "failed",
        error: "run did not complete; no credentials or request bodies are emitted",
      });
      process.exitCode = 1;
    } finally {
      sampler?.finish();
      stream?.close();
    }
  }
}
async function exploreState(provider: RpcProvider, fixture: Fixture) {
  const read = (entrypoint: string) =>
    provider.callContract(
      { contractAddress: fixture.contract, entrypoint, calldata: [fixture.game!.id] },
      "pre_confirmed",
    );
  const [budget, day] = await Promise.all([read("lords_budget"), read("day")]);
  return { budget, day: day.map((value) => BigInt(value).toString()) };
}
if (import.meta.main)
  main().catch(() => {
    console.error("node-first runner failed; no credentials emitted");
    process.exitCode = 1;
  });
