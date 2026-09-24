import { utils as starknetKeyUtils } from "@scure/starknet";
import { signGameplayIntent } from "@bibliothecadao/provider";
import { botRealmsId, realmsAccountAddress, type DeviceChange } from "@realms-world/identity/account";
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
// Like every native submit: no tip, so no tip estimate reads recent blocks before signing.
const NO_TIP = { tip: 0 };
const DEVICE_KEY_STORAGE_KEY = "realms:device-key";
const RECEIPT_POLL_MS = 250;

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

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

/** The identity Worker of the shard's environment, reached with that environment's operator token. */
export interface OperatorIdentity {
  /** The identity API's base, e.g. https://staging.realms.party/api. */
  url: string;
  operatorToken: string;
}

/**
 * A bot (the shard's operator, a harness player) enrols through the environment's guardian like any player: the
 * identity Worker's operator route approves its device changes, and only on the account the bot's label places.
 */
export const approveBotDevice =
  (identity: OperatorIdentity, label: string): GuardianApproval =>
  async (change) => {
    const response = await fetch(`${identity.url}/devices/bots`, {
      method: "POST",
      headers: { authorization: `Bearer ${identity.operatorToken}`, "content-type": "application/json" },
      body: JSON.stringify({
        label,
        chainId: change.chainId,
        account: change.account,
        action: change.action,
        deviceKey: change.deviceKey,
        counter: change.counter,
      }),
    });
    if (!response.ok) {
      throw new Error(`Bot device approval for ${change.account} refused: ${response.status} ${await response.text()}`);
    }
    return ((await response.json()) as { signature: string[] }).signature;
  };

/** A bot's gameplay account on one shard, named by its label and joined with the guardian's approval. */
export const joinBotAccount = (input: {
  provider: ProviderInterface;
  shard: RealmsAccountShard;
  label: string;
  device: DeviceKey;
  identity: OperatorIdentity;
}): Promise<Account> =>
  joinRealmsAccount({
    provider: input.provider,
    shard: input.shard,
    realmsId: botRealmsId(input.label),
    device: input.device,
    approve: approveBotDevice(input.identity, input.label),
  });

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

/** A removed device returns only as a new one: the next sign-in on this browser makes a fresh key. */
export function forgetDeviceKey(storage: StorageLike): void {
  storage.removeItem(DEVICE_KEY_STORAGE_KEY);
}

/**
 * Makes this device a signer of the player's account on one shard: deploys the account with the device as its first
 * key, or adds the device to an account another device deployed. Either way the transaction carries the guardian's
 * approval in a five-felt signature, which the account applies while validating it.
 */
export function joinRealmsAccount(input: {
  provider: ProviderInterface;
  shard: RealmsAccountShard;
  realmsId: string;
  device: DeviceKey;
  approve: GuardianApproval;
}): Promise<Account> {
  const address = realmsAccountAddress(input.realmsId, input.shard.accountClassHash, input.shard.guardianPublicKey);
  const key = `${input.shard.chainId}:${address}:${input.device.publicKey}`;
  // One join per device and account at a time: a second caller (the game route mounting the sync again) waits for the
  // first instead of asking the guardian for the same counter and sending a transaction the account refuses.
  let join = joinsInFlight.get(key);
  if (!join) {
    join = joinOnce(input, address).finally(() => joinsInFlight.delete(key));
    joinsInFlight.set(key, join);
  }
  return join;
}

const joinsInFlight = new Map<string, Promise<Account>>();

async function joinOnce(
  {
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
  },
  address: string,
): Promise<Account> {
  const approval = (counter: number) =>
    approve({ chainId: shard.chainId, account: address, action: "ADD", deviceKey: device.publicKey, counter });

  if (!(await isAccountDeployed(provider, address, shard.accountClassHash))) {
    const deployer = realmsAccount(provider, address, device, await approval(1));
    const deployed = await deployer.deployAccount(
      {
        classHash: shard.accountClassHash,
        constructorCalldata: [realmsId, shard.guardianPublicKey],
        addressSalt: realmsId,
        contractAddress: address,
      },
      NO_TIP,
    );
    await provider.waitForTransaction(deployed.transaction_hash, { retryInterval: RECEIPT_POLL_MS });
  } else if (!(await isDevice(provider, address, device.publicKey))) {
    // A device the player removed never adds itself back; it returns only as a new device after a fresh sign-in.
    if (await wasRevoked(provider, address, device.publicKey)) throw new DeviceRemovedError(address);
    const counter = (await deviceChangeCounter(provider, address)) + 1;
    const joining = realmsAccount(provider, address, device, await approval(counter));
    const joined = await joining.execute(isDeviceCall(address, device.publicKey), NO_TIP);
    await provider.waitForTransaction(joined.transaction_hash, { retryInterval: RECEIPT_POLL_MS });
  }
  return realmsAccount(provider, address, device);
}

export class DeviceRemovedError extends Error {
  constructor(readonly account: string) {
    super("This device was removed from your account. Sign in again to add it as a new device.");
  }
}

const DEVICE_ADDED = num.toHex(hash.starknetKeccak("DeviceAdded"));
const DEVICE_REVOKED = num.toHex(hash.starknetKeccak("DeviceRevoked"));

/** The account's devices on one shard, from its DeviceAdded and DeviceRevoked events in order. */
async function listDevices(provider: ProviderInterface, address: string): Promise<string[]> {
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
async function revokeDevice({
  account,
  shard,
  deviceKey,
  approve,
}: {
  account: Account;
  shard: DeviceShard;
  deviceKey: string;
  approve: GuardianApproval;
}): Promise<string> {
  const counter = (await deviceChangeCounter(shard.provider, account.address)) + 1;
  const [r, s] = await approve({
    chainId: shard.chainId,
    account: account.address,
    action: "REVOKE",
    deviceKey,
    counter,
  });
  const result = await account.execute(
    {
      contractAddress: account.address,
      entrypoint: "revoke_device",
      calldata: [deviceKey, r, s],
    },
    NO_TIP,
  );
  await account.waitForTransaction(result.transaction_hash, { retryInterval: RECEIPT_POLL_MS });
  return result.transaction_hash;
}

/** One shard's part of an account-wide device operation: where the account lives there and how to reach it. */
export interface DeviceShard extends RealmsAccountShard {
  url: string;
  provider: ProviderInterface;
}

/** A shard whose part of an account-wide device operation failed, named with its reason, never hidden. */
export interface DeviceShardFailure {
  shard: string;
  error: Error;
}

/** Each device key of the account and the shards where it signs, plus every shard that could not be read. */
export interface AccountDevices {
  devices: Map<string, DeviceShard[]>;
  failures: DeviceShardFailure[];
}

/** The devices of the account at this address across these shards, each read from that shard's own device events. */
export async function readAccountDevices(address: string, shards: readonly DeviceShard[]): Promise<AccountDevices> {
  const devices = new Map<string, DeviceShard[]>();
  const failures = await forEachShard(shards, async (shard) => {
    for (const key of await listDevices(shard.provider, address)) {
      devices.set(key, [...(devices.get(key) ?? []), shard]);
    }
  });
  return { devices, failures };
}

/**
 * Removes a device from the account on every one of these shards, each with that shard's own guardian approval and
 * counter; returns the shards where it failed. A shard only accepts a revocation the account sends itself, signed by one
 * of its devices, so this device first joins the account where it never has.
 */
export async function revokeDeviceEverywhere({
  shards,
  realmsId,
  device,
  deviceKey,
  approve,
}: {
  shards: readonly DeviceShard[];
  realmsId: string;
  device: DeviceKey;
  deviceKey: string;
  approve: GuardianApproval;
}): Promise<DeviceShardFailure[]> {
  return forEachShard(shards, async (shard) => {
    const account = await joinRealmsAccount({ provider: shard.provider, shard, realmsId, device, approve });
    await revokeDevice({ account, shard, deviceKey, approve });
  });
}

/** Runs the operation on every shard at once; one shard failing never stops or hides the others. */
async function forEachShard(
  shards: readonly DeviceShard[],
  operation: (shard: DeviceShard) => Promise<void>,
): Promise<DeviceShardFailure[]> {
  const results = await Promise.allSettled(shards.map(operation));
  return results.flatMap((result, index) =>
    result.status === "rejected"
      ? [
          {
            shard: shards[index]!.url,
            error: result.reason instanceof Error ? result.reason : new Error(String(result.reason)),
          },
        ]
      : [],
  );
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
  if (result === undefined) throw new Error(`Realms account ${address} returned no device answer`);
  return BigInt(result) === 1n;
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
