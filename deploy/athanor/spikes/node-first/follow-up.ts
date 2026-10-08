// Throwaway independent-game follow-up. Signed payloads stay private and outside evidence.
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
  type Fixture,
} from "./common";
import { burst, subscribe, type ObservedReceipt } from "./run";
import { waitForLastReceipt, waitForNonemptyClose, type Trigger } from "./follow-up-release";

type Sends = Awaited<ReturnType<typeof burst>>;
function followupEvidence(
  rows: Sends,
  received: Map<string, ObservedReceipt>,
  trigger: Trigger | null,
  first: bigint,
  heads: number[],
  failure: string | null,
) {
  const actions = rows.map((row) => ({
    ...row,
    receiptNs: received.has(row.hash) ? String(received.get(row.hash)!.at) : null,
    receiptBlockNumber: received.get(row.hash)?.blockNumber ?? null,
    executionStatus: received.get(row.hash)?.status ?? null,
  }));
  const latencies = actions.flatMap((row) => (row.receiptNs ? [ms(BigInt(row.receiptNs) - first)] : []));
  const roundTrips = actions.flatMap((row) =>
    row.acknowledgedNs ? [ms(BigInt(row.acknowledgedNs) - BigInt(row.sentNs))] : [],
  );
  const complete = actions.every((row) => row.executionStatus === "SUCCEEDED" && !row.error);
  const released = trigger;
  return {
    mode: "24 simultaneous genuine CreateExplorer Y actions;independent game and actors",
    trigger: released,
    actualOffsetMs: released ? ms(first - BigInt(released.observedNs)) : null,
    targetLatenessMs: released ? ms(first - BigInt(released.targetNs)) : null,
    firstSendNs: String(first),
    lastReceiptNs: complete ? String(first + BigInt(Math.round(Math.max(...latencies) * 1000000))) : null,
    spreadMs: ms(rows.reduce((at, row) => (BigInt(row.sentNs) > at ? BigInt(row.sentNs) : at), first) - first),
    completed: actions.filter((row) => row.executionStatus === "SUCCEEDED").length,
    acknowledgementRoundTrip: {
      sampleCount: roundTrips.length,
      p50Ms: percentile(roundTrips, 0.5),
      p95Ms: percentile(roundTrips, 0.95),
    },
    p50Ms: percentile(latencies, 0.5),
    p95Ms: percentile(latencies, 0.95),
    lastMs: complete ? Math.max(...latencies) : null,
    streamError: failure,
    actions,
    heads,
  };
}

async function main() {
  const a = args(["fixture", "rpc-url", "ws-url", "out", "checkpoint", "offset-ms", "close-log", "ready-file"]);
  const fixture = load<Fixture>(required(a.fixture, "fixture"));
  if (fixture.game?.kind !== "CreateExplorer" || fixture.game.arm !== "Y" || fixture.players.length !== 24)
    throw new Error("Independent 24-actor CreateExplorer Y fixture required");
  if (a.checkpoint && a["close-log"]) throw new Error("Choose one primary trigger");
  const out = trialDirectory(required(a.out, "out"));
  const url = loopback(required(a["rpc-url"], "rpc-url"));
  const provider = new RpcProvider({ nodeUrl: url });
  if (BigInt(await provider.getChainId()) !== BigInt(fixture.chainId)) throw new Error("Trial chain mismatch");
  const payloads = await mapWithConcurrency(fixture.players, 8, (player) =>
    presign(fixture, player, provider, 0, 1, 1, 1),
  );
  const received = new Map<string, ObservedReceipt>(),
    heads: number[] = [];
  const stream = await subscribe(required(a["ws-url"], "ws-url"), received, heads, fixture);
  let trigger: Trigger | null = null;
  const ready = () => {
    if (a["ready-file"]) save(a["ready-file"], { readyNs: String(now()), accounts: 24 });
  };
  try {
    const rows = await burst(url, payloads, 4, async () => {
      if (a["close-log"]) trigger = await waitForNonemptyClose(a["close-log"], 600000, ready);
      else {
        ready();
        if (a.checkpoint)
          trigger = await waitForLastReceipt(a.checkpoint, Number(required(a["offset-ms"], "offset-ms")), 600000);
      }
    });
    const first = rows.reduce(
      (at, row) => (BigInt(row.sentNs) < at ? BigInt(row.sentNs) : at),
      BigInt(rows[0]!.sentNs),
    );
    const deadline = now() + 120000000000n;
    while (payloads.some((p) => !received.has(p.hash)) && now() < deadline && !stream.failure())
      await new Promise((resolve) => setTimeout(resolve, 5));
    const evidence = followupEvidence(rows, received, trigger, first, heads, stream.failure());
    save(out, evidence);
    const complete = evidence.completed === 24 && evidence.actions.every((row) => !row.error);
    if (!complete || stream.failure()) process.exitCode = 1;
  } finally {
    stream.close();
  }
}
if (import.meta.main)
  main().catch(() => {
    console.error("Follow-up failed; no credentials emitted");
    process.exitCode = 1;
  });
