import { closeSync, existsSync, mkdirSync, openSync, readdirSync } from "node:fs";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import path from "node:path";
import type {
  LocalSettlementChainObservation,
  LocalSettlementChainPlan,
  LocalSettlementChainProcess,
  LocalSettlementChainStop,
  LocalSettlementSandboxRuntime,
} from "./local-sandbox";

export interface LocalKatanaSandboxRuntimeOptions {
  katanaBinary?: string;
  startupTimeoutMs?: number;
  shutdownTimeoutMs?: number;
  pollIntervalMs?: number;
  rpcRequestTimeoutMs?: number;
  now?: () => Date;
}

interface StartedKatanaProcess {
  child: ChildProcess;
  version: string;
  startError?: Error;
}

const DEFAULT_STARTUP_TIMEOUT_MS = 15_000;
const DEFAULT_SHUTDOWN_TIMEOUT_MS = 5_000;
const DEFAULT_POLL_INTERVAL_MS = 100;
const DEFAULT_RPC_REQUEST_TIMEOUT_MS = 1_000;

export class LocalKatanaSandboxRuntime implements LocalSettlementSandboxRuntime {
  private readonly katanaBinary: string;
  private readonly startupTimeoutMs: number;
  private readonly shutdownTimeoutMs: number;
  private readonly pollIntervalMs: number;
  private readonly rpcRequestTimeoutMs: number;
  private readonly now: () => Date;
  private readonly processes = new Map<LocalSettlementChainPlan["layer"], StartedKatanaProcess>();
  private version?: string;

  constructor(options: LocalKatanaSandboxRuntimeOptions = {}) {
    this.katanaBinary = options.katanaBinary || "katana";
    this.startupTimeoutMs = resolvePositiveDuration(
      options.startupTimeoutMs,
      DEFAULT_STARTUP_TIMEOUT_MS,
      "startup timeout",
    );
    this.shutdownTimeoutMs = resolvePositiveDuration(
      options.shutdownTimeoutMs,
      DEFAULT_SHUTDOWN_TIMEOUT_MS,
      "shutdown timeout",
    );
    this.pollIntervalMs = resolvePositiveDuration(options.pollIntervalMs, DEFAULT_POLL_INTERVAL_MS, "poll interval");
    this.rpcRequestTimeoutMs = resolvePositiveDuration(
      options.rpcRequestTimeoutMs,
      DEFAULT_RPC_REQUEST_TIMEOUT_MS,
      "RPC request timeout",
    );
    this.now = options.now || (() => new Date());
  }

  async startChain(chain: LocalSettlementChainPlan): Promise<LocalSettlementChainProcess> {
    const version = this.resolveKatanaVersion();
    const started = this.launchOwnedKatanaProcess(chain, version);
    return describeStartedChain(chain, started.child, this.now);
  }

  async waitForChain(chain: LocalSettlementChainPlan): Promise<LocalSettlementChainObservation> {
    const started = this.findProcess(chain);
    const deadline = Date.now() + this.startupTimeoutMs;
    let lastError: unknown;

    while (Date.now() < deadline) {
      assertProcessStillRunning(started, chain);
      try {
        const remainingTimeMs = Math.max(1, deadline - Date.now());
        return await observeReadyChain(
          chain,
          started.version,
          this.now,
          Math.min(this.rpcRequestTimeoutMs, remainingTimeMs),
        );
      } catch (error) {
        lastError = error;
        await delay(this.pollIntervalMs);
      }
    }

    throw new Error(
      `Local settlement ${chain.layer} Katana did not become ready within ${this.startupTimeoutMs}ms: ${errorMessage(lastError)}`,
    );
  }

  async stopChain(
    process: LocalSettlementChainProcess,
    chain: LocalSettlementChainPlan,
  ): Promise<LocalSettlementChainStop> {
    const started = this.processes.get(chain.layer);
    if (!started || started.child.pid !== process.processId)
      throw new Error(`Local settlement ${chain.layer} process ${process.processId} is not owned by this run`);
    await stopOwnedProcess(started.child, this.shutdownTimeoutMs);
    this.processes.delete(chain.layer);
    return { stoppedAt: this.now().toISOString() };
  }

  private launchOwnedKatanaProcess(chain: LocalSettlementChainPlan, version: string): StartedKatanaProcess {
    prepareChainDirectories(chain);
    const child = spawnKatana(this.katanaBinary, chain);
    if (!child.pid) throw new Error(`Failed to start local settlement ${chain.layer} Katana process`);
    const started: StartedKatanaProcess = { child, version };
    child.once("error", (error) => {
      started.startError = error;
    });
    this.processes.set(chain.layer, started);
    return started;
  }

  private resolveKatanaVersion(): string {
    if (this.version) return this.version;
    const result = spawnSync(this.katanaBinary, ["--version"], { encoding: "utf8" });
    if (result.error || result.status !== 0) {
      throw new Error(`Local settlement sandbox requires an executable Katana binary: ${errorMessage(result.error)}`);
    }
    const version = `${result.stdout || ""}`
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.startsWith("katana "));
    if (!version) throw new Error("Local settlement sandbox could not resolve the Katana binary version");
    this.version = version;
    return version;
  }

  private findProcess(chain: LocalSettlementChainPlan): StartedKatanaProcess {
    const started = this.processes.get(chain.layer);
    if (!started) throw new Error(`Local settlement ${chain.layer} Katana process is not running`);
    return started;
  }
}

function describeStartedChain(
  chain: LocalSettlementChainPlan,
  child: ChildProcess,
  now: () => Date,
): LocalSettlementChainProcess {
  if (!child.pid) throw new Error(`Local settlement ${chain.layer} Katana process has no process ID`);
  return {
    layer: chain.layer,
    processId: child.pid,
    startedAt: now().toISOString(),
  };
}

function prepareChainDirectories(chain: LocalSettlementChainPlan): void {
  mkdirSync(path.dirname(chain.logFile), { recursive: true });
  assertDirectoryIsEmpty(chain.dataDir);
  mkdirSync(chain.dataDir, { recursive: true });
}

function assertDirectoryIsEmpty(directory: string): void {
  if (existsSync(directory) && readdirSync(directory).length > 0) {
    throw new Error(`Local settlement sandbox refuses non-empty data directory "${directory}"`);
  }
}

function spawnKatana(katanaBinary: string, chain: LocalSettlementChainPlan): ChildProcess {
  const logDescriptor = openSync(chain.logFile, "a");
  try {
    return spawn(katanaBinary, buildKatanaArgs(chain), {
      stdio: ["ignore", logDescriptor, logDescriptor],
    });
  } finally {
    closeSync(logDescriptor);
  }
}

function buildKatanaArgs(chain: LocalSettlementChainPlan): string[] {
  return [
    "--silent",
    "--no-mining",
    "--http.addr",
    "127.0.0.1",
    "--http.port",
    `${chain.port}`,
    "--chain-id",
    chain.chainId,
    "--db-dir",
    chain.dataDir,
    "--log.format",
    "json",
    "--dev",
    "--dev.no-fee",
    "--dev.seed",
    `${chain.seed}`,
    "--dev.accounts",
    "10",
    "--rpc.max-proof-keys",
    "100",
  ];
}

async function observeReadyChain(
  chain: LocalSettlementChainPlan,
  katanaVersion: string,
  now: () => Date,
  requestTimeoutMs: number,
): Promise<LocalSettlementChainObservation> {
  const [encodedChainId, blockNumber, genesisBlock] = await Promise.all([
    callStarknetRpc(chain.rpcUrl, "starknet_chainId", [], requestTimeoutMs),
    callStarknetRpc(chain.rpcUrl, "starknet_blockNumber", [], requestTimeoutMs),
    callStarknetRpc(chain.rpcUrl, "starknet_getBlockWithTxHashes", [{ block_number: 0 }], requestTimeoutMs),
  ]);
  const genesisIdentity = requireGenesisIdentity(genesisBlock);
  return {
    observedChainId: decodeChainId(encodedChainId),
    blockNumber: requireBlockNumber(blockNumber),
    genesisHash: genesisIdentity.genesisHash,
    stateRoot: genesisIdentity.stateRoot,
    katanaVersion,
    readyAt: now().toISOString(),
  };
}

async function callStarknetRpc(rpcUrl: string, method: string, params: unknown[], timeoutMs: number): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error(`${method} timed out after ${timeoutMs}ms`)), timeoutMs);
  try {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`${method} returned HTTP ${response.status}`);
    const payload = (await response.json()) as { result?: unknown; error?: { message?: string } };
    if (payload.error || payload.result === undefined) {
      throw new Error(`${method} failed: ${payload.error?.message || "missing result"}`);
    }
    return payload.result;
  } finally {
    clearTimeout(timeout);
  }
}

function decodeChainId(value: unknown): string {
  if (typeof value !== "string" || !/^0x[0-9a-f]+$/i.test(value)) {
    throw new Error("starknet_chainId returned a malformed value");
  }
  const hex = value.slice(2).padStart(Math.ceil((value.length - 2) / 2) * 2, "0");
  return Buffer.from(hex, "hex").toString("utf8").replace(/\0+$/u, "");
}

function requireBlockNumber(value: unknown): number {
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new Error("starknet_blockNumber returned a malformed value");
  }
  return value as number;
}

function requireGenesisIdentity(value: unknown): { genesisHash: string; stateRoot: string } {
  if (!value || typeof value !== "object") {
    throw new Error("starknet_getBlockWithTxHashes returned a malformed genesis block");
  }
  const block = value as { block_hash?: unknown; new_root?: unknown };
  return {
    genesisHash: requireFelt(block.block_hash, "genesis block hash"),
    stateRoot: requireFelt(block.new_root, "genesis state root"),
  };
}

function requireFelt(value: unknown, label: string): string {
  if (typeof value !== "string" || !/^0x[0-9a-f]+$/i.test(value)) {
    throw new Error(`Local settlement ${label} is malformed`);
  }
  return value.toLowerCase();
}

function assertProcessStillRunning(started: StartedKatanaProcess, chain: LocalSettlementChainPlan): void {
  if (started.startError) {
    throw new Error(`Local settlement ${chain.layer} Katana failed to start: ${started.startError.message}`);
  }
  if (started.child.exitCode !== null || started.child.signalCode !== null) {
    throw new Error(
      `Local settlement ${chain.layer} Katana exited before readiness with ${started.child.signalCode || started.child.exitCode}`,
    );
  }
}

async function stopOwnedProcess(child: ChildProcess, timeoutMs: number): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGTERM");
  if (await waitForExit(child, timeoutMs)) return;
  child.kill("SIGKILL");
  if (!(await waitForExit(child, timeoutMs))) {
    throw new Error(`Local settlement Katana process ${child.pid || "unknown"} did not stop`);
  }
}

function waitForExit(child: ChildProcess, timeoutMs: number): Promise<boolean> {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve(true);
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(false), timeoutMs);
    child.once("exit", () => {
      clearTimeout(timeout);
      resolve(true);
    });
  });
}

function delay(durationMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error || "unknown error");
}

function resolvePositiveDuration(requested: number | undefined, fallback: number, label: string): number {
  const duration = requested ?? fallback;
  if (!Number.isInteger(duration) || duration <= 0) {
    throw new Error(`Local settlement sandbox ${label} must be a positive integer`);
  }
  return duration;
}
