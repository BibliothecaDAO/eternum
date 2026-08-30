import path from "node:path";
import { PostgresCursorStore } from "./cursor-store";
import { loadRelayManifest } from "./manifest";
import { OperatorRelay, runRelayLoop } from "./relay";
import { StarknetRpc } from "./rpc";
import { MAINNET_CHAIN_ID, MainnetResultsWriter, S2RegistrationWriter, createOperatorAccount } from "./writers";

const config = readConfig();
const ledgerRpc = new StarknetRpc(config.ledgerRpcUrl);
const s2Rpc = new StarknetRpc(config.s2RpcUrl);
assertMainnet(await ledgerRpc.chainId());

const manifest = loadRelayManifest(config.s2ManifestPath);
const cursorStore = new PostgresCursorStore(config.databaseUrl);
await cursorStore.initialize();

const relay = new OperatorRelay({
  cursorStore,
  initialLedgerBlock: config.ledgerStartBlock,
  initialS2Block: config.s2StartBlock,
  ledgerAddress: config.ledgerAddress,
  ledgerSource: ledgerRpc,
  registrationWriter: new S2RegistrationWriter(
    createOperatorAccount(config.s2RpcUrl, config.operatorAddress, config.operatorPrivateKey),
    manifest.entrySystemAddress,
    config.s2Chain,
  ),
  resultReadySelector: manifest.resultReadySelector,
  resultRowSelector: manifest.resultRowSelector,
  resultsWriter: new MainnetResultsWriter(
    createOperatorAccount(config.ledgerRpcUrl, config.operatorAddress, config.operatorPrivateKey),
    config.ledgerAddress,
    config.ledgerRpcUrl,
  ),
  s2Source: s2Rpc,
  worldAddress: manifest.worldAddress,
});

const abortController = new AbortController();
for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => abortController.abort());

console.info(
  JSON.stringify({
    event: "operator_started",
    ledgerAddress: config.ledgerAddress,
    ledgerStartBlock: config.ledgerStartBlock,
    operatorAddress: config.operatorAddress,
    s2StartBlock: config.s2StartBlock,
    worldAddress: manifest.worldAddress,
  }),
);

await Promise.all([
  runRelayLoop({
    abort: abortController.signal,
    label: "mainnet-registrations",
    pollMs: config.pollMs,
    run: () => relay.relayRegistrationsOnce(),
  }),
  runRelayLoop({
    abort: abortController.signal,
    label: "s2-results",
    pollMs: config.pollMs,
    run: () => relay.relayResultsOnce(),
  }),
]);
await cursorStore.close();

function readConfig() {
  return {
    databaseUrl: requireEnvironment("DATABASE_URL"),
    ledgerAddress: requireAddress("LEDGER_ADDRESS"),
    ledgerRpcUrl: requireEnvironment("LEDGER_RPC_URL"),
    ledgerStartBlock: requireBlock("LEDGER_START_BLOCK"),
    operatorAddress: requireAddress("LEDGER_OPERATOR_ADDRESS"),
    operatorPrivateKey: requireEnvironment("LEDGER_OPERATOR_PRIVATE_KEY"),
    pollMs: optionalPositiveInteger("OPERATOR_POLL_MS", 1_000),
    s2Chain: requireS2Chain(),
    s2ManifestPath: path.resolve(requireEnvironment("S2_MANIFEST_PATH")),
    s2RpcUrl: requireEnvironment("S2_RPC_URL"),
    s2StartBlock: requireBlock("S2_START_BLOCK"),
  };
}

function requireEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function requireAddress(name: string): string {
  const value = requireEnvironment(name);
  if (BigInt(value) === 0n) throw new Error(`${name} must be non-zero`);
  return `0x${BigInt(value).toString(16)}`;
}

function requireBlock(name: string): number {
  const value = Number(requireEnvironment(name));
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${name} must be a non-negative integer`);
  return value;
}

function optionalPositiveInteger(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
  return value;
}

function requireS2Chain(): "madara" | "appchain" {
  const value = requireEnvironment("S2_CHAIN");
  if (value !== "madara" && value !== "appchain") throw new Error("S2_CHAIN must be madara or appchain");
  return value;
}

function assertMainnet(chainId: string): void {
  if (BigInt(chainId) !== BigInt(MAINNET_CHAIN_ID)) {
    throw new Error(`LEDGER_RPC_URL is not Starknet mainnet (chain id ${chainId})`);
  }
}
