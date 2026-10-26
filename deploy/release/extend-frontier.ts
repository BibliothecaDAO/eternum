#!/usr/bin/env bun
import { readFileSync } from "node:fs";
import { hash, type Call } from "starknet";
import approved from "../../config/source/frontier/extension.json";
import { rpcAt } from "../../packages/value-ledger/src/rpc";
import { readFrontierExtension, requireExtendedFrontier } from "../../apps/value-relay/src/frontier-extension";

type Proof = Awaited<ReturnType<typeof readFrontierExtension>>;

/** Readback is the checkpoint: retries never infer completion from a local transaction file. */
export function extensionCalls(proof: Proof, currentClass: string, reviewedClass: string): Call[] {
  if (proof.worldEnd !== approved.end || proof.release !== approved.release)
    throw new Error("Apply and confirm the approved world release before preparing the ledger extension");
  if (!/^0x[0-9a-f]+$/i.test(reviewedClass) || BigInt(reviewedClass) === 0n)
    throw new Error("Invalid reviewed ledger class");
  const calls: Call[] = [];
  if (BigInt(currentClass) !== BigInt(reviewedClass))
    calls.push({ contractAddress: proof.ledgerAddress, entrypoint: "upgrade", calldata: [reviewedClass] });
  if (proof.ledgerEnd === approved.oldEnd)
    calls.push({
      contractAddress: proof.ledgerAddress,
      entrypoint: "extend_frontier",
      calldata: [approved.chainId, String(approved.gameId)],
    });
  else if (proof.ledgerEnd !== approved.end) throw new Error("Unapproved ledger end");
  return calls;
}

export async function reconcileCalendar(proof: Proof, origin: string, operatorToken: string, network = fetch) {
  requireExtendedFrontier(proof);
  const url = new URL("/api/factory/calendar/frontier", origin);
  if (url.origin !== "https://play.realms.party" || url.username || url.password)
    throw new Error("Extension calendar must be production");
  if (!operatorToken) throw new Error("OPERATOR_TOKEN is required for calendar reconciliation");
  const dates = {
    startsAt: new Date(approved.start * 1000).toISOString(),
    endsAt: new Date(approved.end * 1000).toISOString(),
  };
  const response = await network(url, {
    method: "PUT",
    redirect: "error",
    signal: AbortSignal.timeout(30000),
    headers: { Authorization: `Bearer ${operatorToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(dates),
  });
  if (!response.ok) throw new Error(`Calendar reconciliation refused (${response.status})`);
  const body = (await response.json()) as { phase?: string; startsAt?: string; endsAt?: string };
  if (body.phase !== "frontier" || body.startsAt !== dates.startsAt || body.endsAt !== dates.endsAt)
    throw new Error("Calendar write did not confirm approved dates");
  const readback = await network(new URL("/api/factory/calendar", origin), {
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(30000),
  });
  if (!readback.ok) throw new Error("Calendar readback unavailable; rerun reconciliation");
  const calendar = (await readback.json()) as { phases: (typeof body)[] };
  const frontier = calendar.phases.filter((p) => p.phase === "frontier");
  if (frontier.length !== 1 || frontier[0]!.startsAt !== dates.startsAt || frontier[0]!.endsAt !== dates.endsAt)
    throw new Error("Calendar readback differs; rerun reconciliation");
  return frontier[0];
}

async function main() {
  if (process.argv.slice(2).some((arg) => arg !== "--reconcile-calendar"))
    throw new Error("Usage: bun deploy/release/extend-frontier.ts [--reconcile-calendar]");
  const manifestPath = process.env.NATIVE_WORLD_MANIFEST;
  const ledgerRpc = process.env.L2_RPC_URL;
  const herald = process.env.HERALD_URL;
  const rpcUrl = process.env.RPC_URL;
  if (!manifestPath || !ledgerRpc || !herald || !rpcUrl)
    throw new Error("NATIVE_WORLD_MANIFEST, L2_RPC_URL, HERALD_URL and RPC_URL are required");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const connection = {
    rpcUrl,
    chainId: manifest.shard.chainId as string,
    gamesAddress: manifest.world.address as string,
  };
  const proof = await readFrontierExtension(connection, herald, ledgerRpc);
  if (process.argv.includes("--reconcile-calendar")) {
    console.log(
      JSON.stringify(
        {
          proof,
          calendar: await reconcileCalendar(proof, "https://play.realms.party", process.env.OPERATOR_TOKEN ?? ""),
        },
        null,
        2,
      ),
    );
    return;
  }
  const artifact = JSON.parse(
    readFileSync(
      new URL("../../contracts/l2/ledger/target/dev/game_ledger_GameLedger.contract_class.json", import.meta.url),
      "utf8",
    ),
  );
  const reviewedClass = hash.computeSierraContractClassHash(artifact);
  const currentClass = await rpcAt(ledgerRpc).getClassHashAt(proof.ledgerAddress, proof.ledgerBlock);
  const calls = extensionCalls(proof, currentClass, reviewedClass);
  console.log(
    JSON.stringify(
      {
        proof,
        reviewedClass,
        currentClass,
        calls,
        instruction:
          "Declare the reviewed class if needed, then have the ledger admin sign these calls together. This command submits no chain transaction. Rerun after confirmation, then use --reconcile-calendar.",
      },
      null,
      2,
    ),
  );
}

if (import.meta.main) await main();
