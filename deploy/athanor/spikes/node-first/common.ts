import { readFileSync, writeFileSync, mkdirSync, renameSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import {
  Account,
  BlockTag,
  EDAMode,
  EDataAvailabilityMode,
  hash,
  type Calldata,
  type InvocationsSignerDetails,
} from "starknet";
import { DeviceSigner, deviceKeyOf } from "../../../../packages/core/src/account/realms-account";

export interface Player {
  address: string;
  privateKey: string;
  publicKey: string;
  botId: number;
}
export interface Fixture {
  chainId: string;
  accountClassHash: string;
  guardianPublicKey: string;
  contract: string;
  classHash: string;
  players: Player[];
  entrypoint?: string;
  playerCalldata?: string[][];
  simulationRpc?: string;
  vrfPublicKey?: string[];
  verifyProofs?: boolean;
  game?: { id: number; arm: "X" | "Y"; kind: string; initialCounter: number; wave?: number };
}
export { now } from "./clock";
export const ms = (n: bigint) => Number(n) / 1e6;
const felt = (v: string | bigint | number) => `0x${BigInt(v).toString(16)}`;
export const normalize = (v: string) => felt(v);
export function args(names: string[]) {
  return parseArgs({
    args: process.argv.slice(2),
    options: Object.fromEntries(names.map((n) => [n, { type: "string" as const }])),
    strict: true,
  }).values;
}
export function selectedArms(value: string): ("X" | "Y")[] {
  const arms = value.split(",");
  if (arms.some((arm) => arm !== "X" && arm !== "Y") || new Set(arms).size !== arms.length)
    throw new Error("Choose X, Y or X,Y without duplicates");
  return arms as ("X" | "Y")[];
}
export function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}
export function load<T>(file: string): T {
  return JSON.parse(readFileSync(file, "utf8"));
}
export function save(file: string, data: unknown, privateFile = false) {
  mkdirSync(dirname(resolve(file)), { recursive: true });
  writeFileSync(`${file}.tmp`, JSON.stringify(data, null, 2), { mode: privateFile ? 0o600 : 0o644 });
  renameSync(`${file}.tmp`, file);
}
export function loopback(url: string): string {
  const u = new URL(url);
  if (
    u.protocol !== "http:" ||
    !["127.0.0.1", "localhost"].includes(u.hostname) ||
    Number(u.port) < 28000 ||
    u.username ||
    u.password
  )
    throw new Error("Use a fresh isolated trial's loopback public proxy port >=28000");
  return url;
}
export function trialDirectory(dir: string) {
  const path = resolve(dir);
  if (!/(?:spike|node-first|nodefirst)/i.test(path) || /staging-g/i.test(path))
    throw new Error("Fresh spike trial directory required");
  return path;
}
export function percentile(values: number[], p: number) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)]! : null;
}
export const invokeBounds = {
  l1_gas: { max_amount: 0n, max_price_per_unit: 0n },
  l2_gas: { max_amount: 1_200_000_000n, max_price_per_unit: 0n },
  l1_data_gas: { max_amount: 0n, max_price_per_unit: 0n },
};
export async function presign(
  fixture: Fixture,
  player: Player,
  provider: Account | import("starknet").RpcProvider,
  run: number,
  arm: number,
  writes: number,
  hashes: number,
  nonce?: bigint,
) {
  const account = new Account({
    provider,
    address: player.address,
    signer: new DeviceSigner(deviceKeyOf(player.privateKey)),
    cairoVersion: "1",
  });
  const details: InvocationsSignerDetails = {
    walletAddress: player.address,
    nonce: nonce ?? (await provider.getNonceForAddress(player.address, BlockTag.PRE_CONFIRMED)),
    chainId: fixture.chainId as InvocationsSignerDetails["chainId"],
    cairoVersion: "1",
    version: "0x3",
    resourceBounds: invokeBounds,
    tip: 0n,
    paymasterData: [],
    accountDeploymentData: [],
    nonceDataAvailabilityMode: EDataAvailabilityMode.L1,
    feeDataAvailabilityMode: EDataAvailabilityMode.L1,
  };
  const invocation = await account.buildInvocation(
    [
      {
        contractAddress: fixture.contract,
        entrypoint: fixture.entrypoint ?? "probe",
        calldata: fixture.playerCalldata?.[player.botId] ?? [
          "1",
          String(run),
          String(arm),
          String(writes),
          String(hashes),
        ],
      },
    ],
    details,
  );
  if (!Array.isArray(invocation.calldata) || !invocation.calldata.every((v) => typeof v === "string"))
    throw new Error("Uncompiled invocation");
  const calldata = invocation.calldata as Calldata;
  const transactionHash = hash.calculateInvokeTransactionHash({
    ...details,
    senderAddress: player.address,
    compiledCalldata: calldata,
    nonceDataAvailabilityMode: EDAMode.L1,
    feeDataAvailabilityMode: EDAMode.L1,
  });
  const transaction = {
    type: "INVOKE",
    version: "0x3",
    sender_address: player.address,
    nonce: felt(details.nonce as string),
    calldata: calldata.map(felt),
    signature: (invocation.signature as string[]).map(felt),
    resource_bounds: Object.fromEntries(
      Object.entries(invokeBounds).map(([k, v]) => [
        k,
        { max_amount: felt(v.max_amount), max_price_per_unit: felt(v.max_price_per_unit) },
      ]),
    ),
    tip: "0x0",
    paymaster_data: [],
    account_deployment_data: [],
    nonce_data_availability_mode: "L1",
    fee_data_availability_mode: "L1",
  };
  return {
    address: player.address,
    hash: normalize(transactionHash),
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: player.botId + 1,
      method: "starknet_addInvokeTransaction",
      params: [transaction],
    }),
  };
}

export function storageSlot(name: string, ...keys: (number | string)[]): string {
  let address = hash.starknetKeccak(name).toString();
  for (const key of keys) address = hash.computePedersenHash(address, key);
  return felt(BigInt(address) % (2n ** 251n - 256n));
}
