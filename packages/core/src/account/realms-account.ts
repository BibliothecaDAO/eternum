import { utils as starknetKeyUtils } from "@scure/starknet";
import { signGameplayIntent } from "@bibliothecadao/provider";
import { deviceChangeHash, realmsAccountAddress, type DeviceChange } from "@realms-world/identity/account";
import { Account, BlockTag, ec, hash, num, Signer, type ProviderInterface } from "starknet";

/**
 * A player's gameplay account on a shard: `RealmsAccount` (contracts/l3/player-account), deployed from no deployer with
 * salt = Realms id and constructor `(realms_id, guardian_public_key)`, so it has one address on every shard that shares
 * the class and guardian. Device keys sign `[device_key, r, s]`; a guardian approves each device change.
 * The account's arithmetic (address and guardian message) lives in @realms-world/identity/account, shared with the
 * identity and guardian Workers.
 */

const CONTRACT_NOT_FOUND = 20;
// The account's own state is read where its transactions land: a deployment or device change is pre-confirmed within
// the block, and a read of the last closed block would ask the guardian again with a stale counter.
const ACCOUNT_STATE = BlockTag.PRE_CONFIRMED;
const DEVICE_KEY_STORAGE_KEY = "realms:device-key";
const RECEIPT_POLL_MS = 250;

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export interface DeviceKey {
  privateKey: string;
  publicKey: string;
}

/** The guardian's `[r, s]` over one device change. */
export type GuardianApproval = (change: DeviceChange) => Promise<string[]>;

export interface RealmsAccountShard {
  chainId: string;
  accountClassHash: string;
  guardianPublicKey: string;
}

/** A guardian held by a tool (harness, operator, agent runner) rather than by our guardian Worker. */
export const keyGuardian =
  (privateKey: string): GuardianApproval =>
  async (change) =>
    starkSignature(deviceChangeHash(change), privateKey);

export const deviceKeyOf = (privateKey: string): DeviceKey => ({
  privateKey,
  publicKey: ec.starkCurve.getStarkKey(privateKey),
});

/** One device key per browser origin, shared by every shard and every Realms account signed in on it. */
export function getOrCreateDeviceKey(storage: StorageLike): DeviceKey {
  const stored = storage.getItem(DEVICE_KEY_STORAGE_KEY);
  if (stored !== null) return deviceKeyOf(parseStoredDeviceKey(stored));
  const privateKey = `0x${Array.from(starknetKeyUtils.randomPrivateKey(), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  storage.setItem(DEVICE_KEY_STORAGE_KEY, JSON.stringify({ privateKey, version: 1 }));
  return deviceKeyOf(privateKey);
}

/**
 * Makes this device a signer of the player's account on one shard: deploys the account with the device as its first
 * key, or adds the device to an account another device deployed. Either way the transaction carries the guardian's
 * approval in a five-felt signature, which the account applies while validating it.
 */
export async function joinRealmsAccount({
  provider,
  shard,
  realmsId,
  device,
  approve,
}: {
  provider: ProviderInterface;
  shard: RealmsAccountShard;
  realmsId: string;
  device: DeviceKey;
  approve: GuardianApproval;
}): Promise<Account> {
  const address = realmsAccountAddress(realmsId, shard.accountClassHash, shard.guardianPublicKey);
  const approval = (counter: number) =>
    approve({ chainId: shard.chainId, account: address, action: "ADD", deviceKey: device.publicKey, counter });

  if (!(await isAccountDeployed(provider, address, shard.accountClassHash))) {
    const deployer = realmsAccount(provider, address, device, await approval(1));
    const deployed = await deployer.deployAccount({
      classHash: shard.accountClassHash,
      constructorCalldata: [realmsId, shard.guardianPublicKey],
      addressSalt: realmsId,
      contractAddress: address,
    });
    await provider.waitForTransaction(deployed.transaction_hash, { retryInterval: RECEIPT_POLL_MS });
  } else if (!(await isDevice(provider, address, device.publicKey))) {
    // A device the player removed never adds itself back; it returns only as a new device after a fresh sign-in.
    if (await wasRevoked(provider, address, device.publicKey)) throw new DeviceRemovedError(address);
    const counter = (await deviceChangeCounter(provider, address)) + 1;
    const joining = realmsAccount(provider, address, device, await approval(counter));
    const joined = await joining.execute(isDeviceCall(address, device.publicKey));
    await provider.waitForTransaction(joined.transaction_hash, { retryInterval: RECEIPT_POLL_MS });
  }
  return connectRealmsAccount(provider, shard, realmsId, device);
}

/** This device's handle on the player's account on one shard, without joining it. */
export const connectRealmsAccount = (
  provider: ProviderInterface,
  shard: RealmsAccountShard,
  realmsId: string,
  device: DeviceKey,
): Account =>
  realmsAccount(provider, realmsAccountAddress(realmsId, shard.accountClassHash, shard.guardianPublicKey), device);

class DeviceRemovedError extends Error {
  constructor(readonly account: string) {
    super("This device was removed from your account. Sign in again to add it as a new device.");
  }
}

const DEVICE_ADDED = num.toHex(hash.starknetKeccak("DeviceAdded"));
const DEVICE_REVOKED = num.toHex(hash.starknetKeccak("DeviceRevoked"));

/** The account's devices on one shard, from its DeviceAdded and DeviceRevoked events in order. */
export async function listDevices(provider: ProviderInterface, address: string): Promise<string[]> {
  const devices = new Set<string>();
  for (const { kind, deviceKey } of await deviceChanges(provider, address)) {
    if (kind === DEVICE_ADDED) devices.add(deviceKey);
    else devices.delete(deviceKey);
  }
  return [...devices];
}

async function wasRevoked(provider: ProviderInterface, address: string, deviceKey: string): Promise<boolean> {
  const key = num.toHex(deviceKey);
  return (await deviceChanges(provider, address)).some(
    (change) => change.kind === DEVICE_REVOKED && change.deviceKey === key,
  );
}

async function deviceChanges(provider: ProviderInterface, address: string) {
  const changes: { kind: string; deviceKey: string }[] = [];
  let continuationToken: string | undefined;
  do {
    const page = await provider.getEvents({
      address,
      keys: [[DEVICE_ADDED, DEVICE_REVOKED]],
      from_block: { block_number: 0 },
      to_block: ACCOUNT_STATE,
      chunk_size: 100,
      ...(continuationToken ? { continuation_token: continuationToken } : {}),
    });
    for (const event of page.events)
      changes.push({ kind: num.toHex(event.keys[0]), deviceKey: num.toHex(event.keys[1]) });
    continuationToken = page.continuation_token;
  } while (continuationToken);
  return changes;
}

/** Removes a device on one shard; any device of the account may submit the guardian's approval. */
export async function revokeDevice({
  account,
  shard,
  deviceKey,
  approve,
}: {
  account: Account;
  shard: RealmsAccountShard;
  deviceKey: string;
  approve: GuardianApproval;
}): Promise<string> {
  const counter = (await deviceChangeCounter(account, account.address)) + 1;
  const [r, s] = await approve({
    chainId: shard.chainId,
    account: account.address,
    action: "REVOKE",
    deviceKey,
    counter,
  });
  const result = await account.execute({
    contractAddress: account.address,
    entrypoint: "revoke_device",
    calldata: [deviceKey, r, s],
  });
  await account.waitForTransaction(result.transaction_hash, { retryInterval: RECEIPT_POLL_MS });
  return result.transaction_hash;
}

/** Signs as the account's device; with an approval, the signature also carries the guardian's `[r, s]` to join. */
export class DeviceSigner extends Signer {
  constructor(
    private readonly device: DeviceKey,
    private readonly approval: string[] = [],
  ) {
    super(device.privateKey);
  }
  override async signRaw(digest: string): Promise<string[]> {
    return [...signGameplayIntent(digest, this.device.privateKey), ...this.approval];
  }
}

const realmsAccount = (provider: ProviderInterface, address: string, device: DeviceKey, approval?: string[]) =>
  new Account({ provider, address, signer: new DeviceSigner(device, approval), cairoVersion: "1" });

const isDeviceCall = (address: string, deviceKey: string) => ({
  contractAddress: address,
  entrypoint: "is_device",
  calldata: [deviceKey],
});

async function isDevice(provider: ProviderInterface, address: string, deviceKey: string): Promise<boolean> {
  const [result] = await provider.callContract(isDeviceCall(address, deviceKey), ACCOUNT_STATE);
  return BigInt(result ?? 0) === 1n;
}

async function deviceChangeCounter(provider: ProviderInterface, address: string): Promise<number> {
  const [counter] = await provider.callContract(
    { contractAddress: address, entrypoint: "device_change_counter" },
    ACCOUNT_STATE,
  );
  if (counter === undefined) throw new Error(`Realms account ${address} returned no device counter`);
  return Number(BigInt(counter));
}

async function isAccountDeployed(provider: ProviderInterface, address: string, classHash: string): Promise<boolean> {
  try {
    const deployed = await provider.getClassHashAt(address, ACCOUNT_STATE);
    if (BigInt(deployed) !== BigInt(classHash))
      throw new Error(`Account ${address} runs class ${deployed}, expected ${classHash}`);
    return true;
  } catch (error) {
    if (rpcErrorCode(error) === CONTRACT_NOT_FOUND) return false;
    throw error;
  }
}

function starkSignature(digest: string, privateKey: string): string[] {
  const { r, s } = ec.starkCurve.sign(num.toHex(digest), privateKey);
  return [num.toHex(r), num.toHex(s)];
}

function parseStoredDeviceKey(serialized: string): string {
  const record = JSON.parse(serialized) as { privateKey?: unknown; version?: unknown };
  if (record.version !== 1 || typeof record.privateKey !== "string")
    throw new Error(`Invalid device key record at ${DEVICE_KEY_STORAGE_KEY}`);
  return record.privateKey;
}

function rpcErrorCode(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const value = error as { code?: unknown; baseError?: unknown };
  return typeof value.code === "number" ? value.code : rpcErrorCode(value.baseError);
}
