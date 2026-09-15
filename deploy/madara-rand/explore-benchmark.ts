#!/usr/bin/env bun
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import {
  CallData,
  CairoCustomEnum,
  EDataAvailabilityMode,
  RpcProvider,
  type Account,
  type Call,
  type V3InvocationsSignerDetails,
} from "starknet";
import { createMadaraAccount } from "../../config/deployer/clean/shared/madara-account";
import { fixtureAdmin } from "./fixture-admin";
import { admissionFor, commandArguments, hex, readFixture, signedRequest } from "./native-intent";

interface Plan {
  warmup: number;
  samples: number;
  intervalMs: number;
  trafficOffsetMs: number;
  jitterMs: number[];
  sourceRevision: string;
  fixtures: Record<string, { path: string; sha256: string }>;
}
interface Diff {
  type: string;
  preconfirmed?: boolean;
  transaction_hash?: string;
  set?: { model: string; value: Record<string, unknown> }[];
}
interface Delivery {
  epochMs: number;
  message: Diff;
}
interface Sample {
  index: number;
  warmup: boolean;
  layer: string;
  scheduledMs: number;
  submittedMs: number;
  acknowledgedMs?: number;
  transaction?: string;
  action?: string;
  order?: string;
  error?: string;
  delivery?: Delivery;
  receipt?: unknown;
}
const epochMs = () => performance.timeOrigin + performance.now();
const digest = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");

async function observe(port: number, game: string) {
  const deliveries: Delivery[] = [];
  const socket = new WebSocket(`ws://127.0.0.1:${port}/madara/games/${BigInt(game)}`);
  let ready = false;
  let failure: Error | undefined;
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(String(data)) as Diff;
    if (message.type === "hello") socket.send(JSON.stringify({ type: "resume", epoch: "", seq: 0 }));
    if (message.type === "snapshot_end") ready = true;
    if (message.type === "diff" && message.preconfirmed) deliveries.push({ epochMs: epochMs(), message });
  };
  socket.onerror = () => {
    failure = new Error("Herald stream error");
  };
  socket.onclose = () => {
    failure = new Error("Herald disconnected during collection");
  };
  const deadline = Date.now() + 30000;
  while (!ready && !failure && Date.now() < deadline) await sleep(10);
  assert(ready && !failure, failure?.message ?? "Herald snapshot deadline");
  return {
    deliveries,
    check: () => {
      if (failure) throw failure;
    },
    close: () => {
      socket.onclose = null;
      socket.close();
    },
  };
}

async function signedTransaction(account: Account, calls: Call[], nonce: bigint) {
  const details: V3InvocationsSignerDetails = {
    nonce,
    version: "0x3",
    walletAddress: account.address,
    cairoVersion: "1",
    chainId: await account.getChainId(),
    resourceBounds: {
      l1_gas: { max_amount: 100000n, max_price_per_unit: 128n },
      l2_gas: { max_amount: 1200000000n, max_price_per_unit: 100000n },
      l1_data_gas: { max_amount: 100000n, max_price_per_unit: 128n },
    },
    tip: 0,
    paymasterData: [],
    accountDeploymentData: [],
    nonceDataAvailabilityMode: EDataAvailabilityMode.L1,
    feeDataAvailabilityMode: EDataAvailabilityMode.L1,
  };
  return { invocation: await account.buildInvocation(calls, details), details };
}

async function nativeActions(path: string, count: number, placement: string, provider: RpcProvider) {
  const fixture = readFixture(path);
  assert.equal(fixture.explorers?.length, count);
  const admission = await admissionFor(provider, fixture);
  assert.equal(BigInt(admission[3]), BigInt(fixture.firstExploreNonce!));
  const endpoint = `http://127.0.0.1:${placement === "embedded" ? 15080 : 15081}/actions`;
  return fixture.explorers!.map((explorer, index) => {
    const context = [...admission];
    context[3] = hex(BigInt(admission[3]) + BigInt(index));
    context[4] = hex(BigInt(admission[4]) + BigInt(index));
    context[7] = hex(BigInt(admission[7]) + BigInt(Math.ceil(index / 4) + 30));
    const { action, ...request } = signedRequest(
      fixture,
      context,
      commandArguments(fixture, "Explore", { explorer_id: explorer, direction: 0 }),
    );
    return {
      explorer,
      action,
      order: context[4],
      submit: async () => {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(request),
          signal: AbortSignal.timeout(30000),
        });
        const body = await response.text();
        assert.equal(response.status, 200, body);
        const acknowledgement = JSON.parse(body);
        assert.equal(BigInt(acknowledgement.action), BigInt(action));
        assert.equal(BigInt(acknowledgement.order), BigInt(context[4]));
        return undefined;
      },
    };
  });
}

async function baselineActions(path: string, count: number, provider: RpcProvider) {
  const fixture = JSON.parse(readFileSync(path, "utf8")) as {
    actor: string;
    game: number;
    explorers: number[];
    manifestPath: string;
    artifactsPath: string;
  };
  assert.equal(fixture.explorers.length, count);
  const manifest = JSON.parse(readFileSync(fixture.manifestPath, "utf8"));
  const contract = manifest.contracts.find((item: { tag: string }) => item.tag === "s2-troop_movement_systems");
  assert(contract, "Missing original exploration system");
  const abi = JSON.parse(
    readFileSync(resolve(fixture.artifactsPath, "eternum_troop_movement_systems.contract_class.json"), "utf8"),
  ).abi;
  const codec = new CallData(abi);
  const player = createMadaraAccount(provider, fixture.actor, "0x3039");
  const nonce = BigInt(await player.getNonce("pre_confirmed"));
  const actions = [];
  for (const [index, explorer] of fixture.explorers.entries()) {
    const call = {
      contractAddress: contract.address,
      entrypoint: "explorer_move",
      calldata: codec.compile("explorer_move", {
        game_id: fixture.game,
        explorer_id: explorer,
        directions: [new CairoCustomEnum({ East: {} })],
        explore: true,
      }),
    };
    const signed = await signedTransaction(player, [call], nonce + BigInt(index));
    actions.push({
      explorer,
      action: undefined,
      order: undefined,
      submit: async () => (await provider.invokeFunction(signed.invocation, signed.details)).transaction_hash,
    });
  }
  return actions;
}

async function trafficActions(provider: RpcProvider, count: number) {
  const account = fixtureAdmin(provider);
  const nonce = BigInt(await account.getNonce("pre_confirmed"));
  const call = {
    contractAddress: "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d",
    entrypoint: "transfer",
    calldata: [account.address, "1", "0"],
  };
  const actions = [];
  for (let index = 0; index < count; index++)
    actions.push(await signedTransaction(account, [call], nonce + BigInt(index)));
  return actions;
}

async function main() {
  const [planPath, placement, output] = process.argv.slice(2);
  assert(
    planPath && output && ["baseline", "embedded", "sidecar"].includes(placement),
    "usage: explore-benchmark.ts FROZEN_PLAN PLACEMENT OUTPUT_JSON",
  );
  const plan = JSON.parse(readFileSync(planPath, "utf8")) as Plan;
  assert.equal(
    execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim(),
    "",
    "Measurement source must be clean",
  );
  assert.equal(execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), plan.sourceRevision);
  const fixturePath = plan.fixtures[placement].path;
  assert.equal(digest(fixturePath), plan.fixtures[placement].sha256);
  const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
  assert.equal(fixture.rpc, "http://127.0.0.1:15050/rpc/v0_9_0");
  const count = plan.warmup + plan.samples;
  const provider = new RpcProvider({ nodeUrl: fixture.rpc });
  const actions =
    placement === "baseline"
      ? await baselineActions(fixturePath, count, provider)
      : await nativeActions(fixturePath, count, placement, provider);
  const traffic = await trafficActions(provider, count);
  const stream = await observe(placement === "baseline" ? 13005 : 13003, String(fixture.game));
  const samples: Sample[] = [];
  const trafficResults: { index: number; transaction?: string; error?: string }[] = [];
  const start = epochMs() + 1000;
  const schedule = async (at: number, action: () => Promise<void>) => {
    await sleep(Math.max(0, at - epochMs()));
    await action();
  };
  const pending: Promise<void>[] = [];
  for (const [index, action] of actions.entries()) {
    const scheduledMs = start + index * plan.intervalMs + plan.jitterMs[index % plan.jitterMs.length];
    pending.push(
      schedule(scheduledMs, async () => {
        const sample: Sample = {
          index,
          warmup: index < plan.warmup,
          layer: index % 2 ? "ethereal" : "surface",
          scheduledMs,
          submittedMs: epochMs(),
          action: action.action,
          order: action.order,
        };
        samples.push(sample);
        try {
          sample.transaction = await action.submit();
          sample.acknowledgedMs = epochMs();
        } catch (error) {
          sample.error = String(error);
        }
      }),
    );
    pending.push(
      schedule(scheduledMs + plan.trafficOffsetMs, async () => {
        try {
          const result = await provider.invokeFunction(traffic[index].invocation, traffic[index].details);
          trafficResults.push({ index, transaction: result.transaction_hash });
        } catch (error) {
          trafficResults.push({ index, error: String(error) });
        }
      }),
    );
  }
  try {
    await Promise.all(pending);
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      stream.check();
      for (const sample of samples) {
        sample.delivery ??= stream.deliveries.find(({ message }) =>
          message.set?.some(
            (row) =>
              row.model === "ExplorerTroops" &&
              BigInt(String(row.value.explorer_id)) === BigInt(actions[sample.index].explorer),
          ),
        );
        sample.transaction ??= sample.delivery?.message.transaction_hash;
      }
      if (samples.every((sample) => sample.delivery || sample.error)) break;
      await sleep(10);
    }
    for (const sample of samples) {
      if (!sample.delivery) sample.error ??= "No pre-confirmed explorer row within the run deadline";
      if (sample.transaction) sample.receipt = await provider.getTransactionReceipt(sample.transaction);
    }
  } finally {
    stream.close();
    writeFileSync(
      output,
      JSON.stringify(
        {
          schema: 1,
          scope: "single-host matched explore comparison",
          placement,
          planSha256: digest(planPath),
          sourceRevision: plan.sourceRevision,
          gitDirty: false,
          startEpochMs: start,
          endEpochMs: epochMs(),
          samples: samples.sort((a, b) => a.index - b.index),
          trafficResults,
          deliveries: stream.deliveries,
        },
        null,
        2,
      ) + "\n",
      { flag: "wx" },
    );
  }
  assert(
    samples.every((sample) => !sample.error),
    "Action failure retained in report",
  );
  assert(
    trafficResults.every((result) => !result.error),
    "Competing traffic failure retained in report",
  );
}
main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
