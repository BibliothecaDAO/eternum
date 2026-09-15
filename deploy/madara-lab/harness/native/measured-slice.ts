import { writeFile } from "node:fs/promises";
import { setBlockTimestampSource } from "@bibliothecadao/eternum";
import type { RpcProvider } from "starknet";
import { collectHarnessEvidenceBeforeRun, finishHarnessEvidence } from "../report";
import { observeActions, type SliceActionEvidence } from "./action-evidence";
import { playSlice } from "./workload";

type Workload = Omit<Parameters<typeof playSlice>[0], "act">;

/** The same lifecycle and deadline cover both transports, including failed runs. */
export async function runMeasuredSlice(
  workload: Workload,
  provider: RpcProvider,
  evidence: ReturnType<typeof observeActions>,
  reportPath: string,
  metadata: Record<string, unknown>,
) {
  const actions: SliceActionEvidence[] = [];
  const environment = await collectHarnessEvidenceBeforeRun();
  const workloadStartedAt = new Date().toISOString();
  let passed = false;
  let failure: string | undefined;
  let coverage: Awaited<ReturnType<typeof playSlice>> | undefined;
  try {
    coverage = await playSlice({ ...workload, act });
    passed = true;
  } catch (error) {
    failure = error instanceof Error ? error.stack || error.message : String(error);
    throw error;
  } finally {
    workload.client.dispose();
    setBlockTimestampSource(null);
    const workloadEndedAt = new Date().toISOString();
    const host = await finishHarnessEvidence(environment, workloadStartedAt, workloadEndedAt);
    const report = { ...metadata, passed, failure, coverage, workloadStartedAt, workloadEndedAt, host, actions };
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  }

  async function act(name: string, layer: SliceActionEvidence["layer"], submit: () => Promise<unknown>) {
    const result = await evidence.measure(workload.client, provider, name, layer, async () => {
      const transaction = (await submit()) as { transaction_hash?: string };
      if (!transaction.transaction_hash) throw new Error(`${name} returned no transaction hash`);
      return { transaction_hash: transaction.transaction_hash };
    });
    actions.push(result);
    console.log(JSON.stringify(result));
  }
}
