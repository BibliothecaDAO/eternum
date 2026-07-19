import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { hash } from "starknet";
import {
  a18DeterministicShellClassHash,
  a18KatanaSourceCommit,
  buildA18GenesisInputs,
} from "../../packages/settlement-codec/src/deployment-identity-vector";

const REPOSITORY_ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const SHELL_ARTIFACT_PATH = resolve(
  REPOSITORY_ROOT,
  "contracts/settlement_protocol/target/dev/settlement_protocol_DeterministicShellSpike.contract_class.json",
);
const KATANA_PROVENANCE_PATH = resolve(
  REPOSITORY_ROOT,
  "packages/settlement-codec/schema/katana-release-provenance-a18-v1.json",
);
const EXPECTED_KATANA_ARCHIVE_URL =
  "https://github.com/dojoengine/katana/releases/download/v1.7.1/katana_v1.7.1_linux_amd64.tar.gz";
const EXPECTED_KATANA_ARCHIVE_SHA256 = "34632a9640b4572fb46a227deb645334addf1ca88431613da47ea8e7c70992e1";
const EXPECTED_KATANA_BINARY_VERSION = "katana 1.7.1 (7882660)";

interface KatanaReleaseProvenance {
  readonly schema: string;
  readonly repository: string;
  readonly tag: string;
  readonly sourceCommit: string;
  readonly binaryVersion: string;
  readonly linuxAmd64: {
    readonly url: string;
    readonly sha256: string;
  };
}

interface KatanaGenesisHeader {
  readonly block_number: number;
  readonly parent_hash: string;
  readonly timestamp: number;
  readonly sequencer_address: string;
  readonly new_root: string;
  readonly l1_gas_price: {
    readonly price_in_wei: string;
    readonly price_in_fri: string;
  };
}

export interface ReproducedA18KatanaGenesis {
  readonly stateRoot: bigint;
  readonly document: object;
}

interface RunningKatana {
  readonly process: ChildProcess;
  readonly output: () => string;
}

export async function reproduceA18KatanaGenesis(): Promise<ReproducedA18KatanaGenesis> {
  const provenance = readAndVerifyKatanaProvenance();
  assertPinnedKatanaBinary(provenance.binaryVersion);
  const classArtifact = readAndVerifyShellArtifact();
  const workingDirectory = mkdtempSync(resolve(tmpdir(), "a18-katana-genesis-"));
  const port = await reserveAvailablePort();

  try {
    const sourceDocument = buildA18GenesisInputs(0n).katanaGenesis;
    const runnableDocument = embedClassArtifact(sourceDocument, classArtifact);
    const genesisPath = resolve(workingDirectory, "genesis.json");
    const configPath = resolve(workingDirectory, "katana.toml");
    writeFileSync(genesisPath, `${JSON.stringify(runnableDocument, null, 2)}\n`);
    writeFileSync(configPath, "[dev]\ntotal_accounts = 0\n");
    const running = startKatana(genesisPath, configPath, workingDirectory, port);
    try {
      const stateRoot = await waitForGenesisIdentity(port, running, sourceDocument);
      const document = embedClassArtifact(buildA18GenesisInputs(stateRoot).katanaGenesis, classArtifact);
      return { stateRoot, document };
    } finally {
      await stopKatana(running.process);
    }
  } finally {
    rmSync(workingDirectory, { recursive: true, force: true });
  }
}

async function reserveAvailablePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("failed to reserve a Katana RPC port");
  await new Promise<void>((resolveClose, rejectClose) =>
    server.close((error) => (error ? rejectClose(error) : resolveClose())),
  );
  return address.port;
}

function readAndVerifyKatanaProvenance(): KatanaReleaseProvenance {
  const provenance = JSON.parse(readFileSync(KATANA_PROVENANCE_PATH, "utf8")) as KatanaReleaseProvenance;
  if (
    provenance.schema !== "katana-release-provenance-a18-v1" ||
    provenance.repository !== "https://github.com/dojoengine/katana" ||
    provenance.tag !== "v1.7.1" ||
    BigInt(`0x${provenance.sourceCommit}`) !== a18KatanaSourceCommit() ||
    provenance.binaryVersion !== EXPECTED_KATANA_BINARY_VERSION ||
    provenance.linuxAmd64.url !== EXPECTED_KATANA_ARCHIVE_URL ||
    provenance.linuxAmd64.sha256 !== EXPECTED_KATANA_ARCHIVE_SHA256
  ) {
    throw new Error("A18 Katana release provenance does not match the approved source identity");
  }
  return provenance;
}

function assertPinnedKatanaBinary(expectedVersion: string): void {
  const result = spawnSync("katana", ["--version"], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`pinned Katana binary is unavailable: ${result.stderr}`);
  const reportedVersion = result.stdout.trim().split("\n", 1)[0];
  if (reportedVersion !== expectedVersion) {
    throw new Error(`expected ${expectedVersion}, received ${reportedVersion}`);
  }
}

function readAndVerifyShellArtifact(): object {
  const artifact = JSON.parse(readFileSync(SHELL_ARTIFACT_PATH, "utf8")) as object;
  const actualClassHash = BigInt(hash.computeSierraContractClassHash(artifact));
  if (actualClassHash !== a18DeterministicShellClassHash()) {
    throw new Error("A18 shell artifact class hash does not match the approved deployment profile");
  }
  return artifact;
}

function embedClassArtifact(source: ReturnType<typeof buildA18GenesisInputs>["katanaGenesis"], artifact: object) {
  return {
    ...source,
    classes: source.classes.map((entry) => ({ ...entry, class: artifact })),
  };
}

function startKatana(genesisPath: string, configPath: string, workingDirectory: string, port: number): RunningKatana {
  const process = spawn(
    "katana",
    [
      "--dev",
      "--config",
      configPath,
      "--no-mining",
      "--chain-id",
      "0x232a",
      "--genesis",
      genesisPath,
      "--db-dir",
      resolve(workingDirectory, "database"),
      "--http.addr",
      "127.0.0.1",
      "--http.port",
      port.toString(),
      "--silent",
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  let output = "";
  process.stdout?.on("data", (chunk) => (output += chunk.toString()));
  process.stderr?.on("data", (chunk) => (output += chunk.toString()));
  return { process, output: () => output.trim() };
}

async function waitForGenesisIdentity(
  port: number,
  running: RunningKatana,
  expected: ReturnType<typeof buildA18GenesisInputs>["katanaGenesis"],
): Promise<bigint> {
  const deadline = Date.now() + 30_000;
  let lastError = "Katana did not accept an RPC request";

  while (Date.now() < deadline) {
    if (running.process.exitCode !== null) throw new Error(processFailure(running));
    try {
      const response = await fetch(`http://127.0.0.1:${port}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "starknet_getBlockWithTxHashes",
          params: [{ block_number: 0 }],
        }),
      });
      const payload = (await response.json()) as { result?: KatanaGenesisHeader; error?: { message?: string } };
      if (payload.result?.new_root) {
        await assertKatanaChainId(port, expected);
        assertGenesisHeader(payload.result, expected);
        return BigInt(payload.result.new_root);
      }
      lastError = payload.error?.message ?? "genesis block response omitted new_root";
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
  }

  throw new Error(`timed out reproducing the A18 Katana genesis root: ${lastError}`);
}

async function assertKatanaChainId(
  port: number,
  expected: ReturnType<typeof buildA18GenesisInputs>["katanaGenesis"],
): Promise<void> {
  const response = await fetch(`http://127.0.0.1:${port}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "starknet_chainId", params: [] }),
  });
  const payload = (await response.json()) as { result?: string };
  const expectedChainId = buildA18GenesisInputs(0n).genesisArtifact.chainId;
  if (!payload.result || BigInt(payload.result) !== expectedChainId || expectedChainId !== 9002n) {
    throw new Error(`Katana chain ID does not match the A18 genesis identity: ${payload.result ?? "missing"}`);
  }
  if (expected.number !== 0) throw new Error("A18 genesis document must describe block zero");
}

function assertGenesisHeader(
  actual: KatanaGenesisHeader,
  expected: ReturnType<typeof buildA18GenesisInputs>["katanaGenesis"],
): void {
  const checks: readonly [string, bigint, bigint][] = [
    ["block number", BigInt(actual.block_number), BigInt(expected.number)],
    ["parent hash", BigInt(actual.parent_hash), BigInt(expected.parentHash)],
    ["timestamp", BigInt(actual.timestamp), BigInt(expected.timestamp)],
    ["sequencer address", BigInt(actual.sequencer_address), BigInt(expected.sequencerAddress)],
    ["ETH gas price", BigInt(actual.l1_gas_price.price_in_wei), BigInt(expected.gasPrices.ETH)],
    ["STRK gas price", BigInt(actual.l1_gas_price.price_in_fri), BigInt(expected.gasPrices.STRK)],
  ];
  for (const [field, observed, committed] of checks) {
    if (observed !== committed) {
      throw new Error(`Katana genesis ${field} mismatch: observed ${observed}, committed ${committed}`);
    }
  }
}

function processFailure(running: RunningKatana): string {
  return `Katana exited before serving the genesis block: ${running.output() || `exit ${running.process.exitCode}`}`;
}

async function stopKatana(process: ChildProcess): Promise<void> {
  if (process.exitCode !== null) return;
  process.kill("SIGTERM");
  await Promise.race([
    new Promise<void>((resolveExit) => process.once("exit", () => resolveExit())),
    new Promise<void>((resolveTimeout) => setTimeout(resolveTimeout, 2_000)),
  ]);
  if (process.exitCode === null) process.kill("SIGKILL");
}
