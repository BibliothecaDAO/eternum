import path from "node:path";
import { assertRelayChainIds, type S2Chain } from "./chains";
import { PostgresCursorStore } from "./cursor-store";
import { loadRelayManifest } from "./manifest";
import { OperatorRelay, runRelayLoop } from "./relay";
import { StarknetRpc } from "./rpc";
import { MainnetResultsWriter, S2RegistrationWriter, createOperatorAccount } from "./writers";

const config = readConfig();
const ledgerRpc = new StarknetRpc(config.ledgerRpcUrl);
const s2Rpc = new StarknetRpc(config.s2RpcUrl);
const [ledgerChainId, s2ChainId] = await Promise.all([ledgerRpc.chainId(), s2Rpc.chainId()]);
assertRelayChainIds(ledgerChainId, s2ChainId, config.s2Chain);

const manifest = loadRelayManifest(config.s2ManifestPath);
const cursorStore = new PostgresCursorStore(config.databaseUrl);
await cursorStore.initialize();

const relay = new OperatorRelay({
  cursorStore,
  initialLedgerBlock: config.ledgerStartBlock,
  initialS2Block: config.s2StartBlock,
  ledgerConfirmationDepth: config.ledgerConfirmationDepth,
  ledgerAddress: config.ledgerAddress,
  ledgerSource: ledgerRpc,
  registrationWriter: new S2RegistrationWriter(
    createOperatorAccount(config.s2RpcUrl, config.s2OperatorAddress, config.s2OperatorPrivateKey),
    manifest.entrySystemAddress,
    config.s2Chain,
  ),
  resultReadySelector: manifest.resultReadySelector,
  resultRowSelector: manifest.resultRowSelector,
  resultsWriter: new MainnetResultsWriter(
    createOperatorAccount(config.ledgerRpcUrl, config.ledgerOperatorAddress, config.ledgerOperatorPrivateKey),
    config.ledgerAddress,
    config.ledgerRpcUrl,
  ),
  s2Source: s2Rpc,
  worldAddress: manifest.worldAddress,
});
await relay.acquireStreamLocks();

const abortController = new AbortController();
for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => abortController.abort());

console.info(
  JSON.stringify({
    event: "operator_started",
    ledgerAddress: config.ledgerAddress,
    ledgerConfirmationDepth: config.ledgerConfirmationDepth,
    ledgerStartBlock: config.ledgerStartBlock,
    ledgerOperatorAddress: config.ledgerOperatorAddress,
    s2OperatorAddress: config.s2OperatorAddress,
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
    ledgerConfirmationDepth: requirePositiveInteger("LEDGER_CONFIRMATION_DEPTH"),
    ledgerRpcUrl: requireEnvironment("LEDGER_RPC_URL"),
    ledgerStartBlock: requireBlock("LEDGER_START_BLOCK"),
    ledgerOperatorAddress: requireAddress("LEDGER_OPERATOR_ADDRESS"),
    ledgerOperatorPrivateKey: requireEnvironment("LEDGER_OPERATOR_PRIVATE_KEY"),
    pollMs: optionalPositiveInteger("OPERATOR_POLL_MS", 1_000),
    s2Chain: requireS2Chain(),
    s2ManifestPath: path.resolve(requireEnvironment("S2_MANIFEST_PATH")),
    s2OperatorAddress: requireAddress("S2_OPERATOR_ADDRESS"),
    s2OperatorPrivateKey: requireEnvironment("S2_OPERATOR_PRIVATE_KEY"),
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

function requirePositiveInteger(name: string): number {
  const value = Number(requireEnvironment(name));
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
  return value;
}

function optionalPositiveInteger(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
  return value;
}

function requireS2Chain(): S2Chain {
  const value = requireEnvironment("S2_CHAIN");
  if (value !== "madara" && value !== "appchain") throw new Error("S2_CHAIN must be madara or appchain");
  return value;
}
