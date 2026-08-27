import { getStarkKey, utils as starknetKeyUtils } from "@scure/starknet";
import { resolveEndpoint, type GameChain } from "@realms-world/chain";
import { Account, addAddressPadding, hash, num, type BigNumberish, type ProviderInterface } from "starknet";

const CONTRACT_NOT_FOUND = 20;
const GAMEPLAY_KEY_PREFIX = "realms:gameplay-key";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

interface StoredGameplayKey {
  privateKey: string;
  version: 1;
}

export interface GameplayKey {
  privateKey: string;
  publicKey: string;
}

export interface GameplayAccountApi {
  bind: (gameplayAddress: string, publicKey: string) => Promise<void>;
  rotate: (publicKey: string) => Promise<string>;
}

export interface GameplayAccountDeployment {
  address: string;
  addressSalt: string;
  constructorCalldata: [string, string, string];
}

export interface EnsureGameplayAccountOptions {
  authority: BigNumberish;
  classHash: string;
  owner: BigNumberish;
  privateKey: string;
  provider: ProviderInterface;
  publicKey: string;
}

export function buildGameplayAccountDeployment({
  authority,
  classHash,
  owner,
  publicKey,
}: Omit<EnsureGameplayAccountOptions, "privateKey" | "provider">): GameplayAccountDeployment {
  const normalizedPublicKey = num.toHex(publicKey);
  const constructorCalldata: [string, string, string] = [normalizedPublicKey, num.toHex(owner), num.toHex(authority)];

  return {
    address: calculateGameplayAccountAddress(classHash, normalizedPublicKey, constructorCalldata),
    addressSalt: normalizedPublicKey,
    constructorCalldata,
  };
}

export async function assertGameplayAccountClassDeclared(
  provider: ProviderInterface,
  classHash: BigNumberish,
): Promise<void> {
  await provider.getClass(classHash);
}

export async function ensureGameplayAccount(options: EnsureGameplayAccountOptions): Promise<Account> {
  const deployment = buildGameplayAccountDeployment(options);
  const account = new Account({
    provider: options.provider,
    address: deployment.address,
    signer: options.privateKey,
    cairoVersion: "1",
  });

  if (await isGameplayAccountDeployed(options.provider, deployment.address, options.classHash)) {
    return account;
  }

  await account.deployAccount({
    classHash: options.classHash,
    constructorCalldata: deployment.constructorCalldata,
    addressSalt: deployment.addressSalt,
    contractAddress: deployment.address,
  });
  return account;
}

export async function connectGameplayAccount({
  address,
  classHash,
  privateKey,
  provider,
}: {
  address: string;
  classHash: string;
  privateKey: string;
  provider: ProviderInterface;
}): Promise<Account> {
  if (!(await isGameplayAccountDeployed(provider, address, classHash))) {
    throw new Error(`Gameplay account ${address} is not deployed`);
  }
  return new Account({ provider, address, signer: privateKey, cairoVersion: "1" });
}

export async function readBoundGameplayAccount(
  provider: ProviderInterface,
  registryAddress: string,
  owner: BigNumberish,
): Promise<string | null> {
  const [account] = await provider.callContract({
    contractAddress: registryAddress,
    entrypoint: "account_of",
    calldata: [num.toHex(owner)],
  });
  if (account === undefined) {
    throw new Error(`Player registry ${registryAddress} returned no account`);
  }
  return BigInt(account) === 0n ? null : addAddressPadding(account);
}

export async function readGameplayAccountPublicKey(
  provider: ProviderInterface,
  accountAddress: string,
): Promise<string> {
  const [publicKey] = await provider.callContract({
    contractAddress: accountAddress,
    entrypoint: "get_public_key",
    calldata: [],
  });
  if (publicKey === undefined) {
    throw new Error(`Gameplay account ${accountAddress} returned no public key`);
  }
  return num.toHex(publicKey);
}

export function createGameplayAccountApi({
  baseUrl,
  fetch = globalThis.fetch,
}: {
  baseUrl: string;
  fetch?: typeof globalThis.fetch;
}): GameplayAccountApi {
  const endpoint = resolveEndpoint(baseUrl, { name: "gameplay account API", browserFacing: true });
  const post = async <T>(action: "bind" | "rotate", body: unknown): Promise<T> => {
    const response = await fetch(`${endpoint}/api/gameplay-account/${action}`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const error = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(error?.error ?? `Gameplay account ${action} failed with status ${response.status}`);
    }
    return (await response.json()) as T;
  };

  return {
    bind: async (gameplayAddress, publicKey) => {
      await post("bind", { gameplayAddress, publicKey });
    },
    rotate: async (publicKey) => {
      const result = await post<{ account: string }>("rotate", { publicKey });
      return result.account;
    },
  };
}

export function getOrCreateGameplayKey({
  storage,
  chain,
  chainId,
  owner,
}: {
  storage: StorageLike;
  chain: GameChain;
  chainId: BigNumberish;
  owner: BigNumberish;
}): GameplayKey {
  assertGuestAllowed(chain, owner);

  const existingKey = getStoredGameplayKey({ storage, chainId, owner });
  if (existingKey) {
    return existingKey;
  }

  const storageKey = gameplayKeyStorageKey(chainId, owner);
  const privateKey = bytesToHex(starknetKeyUtils.randomPrivateKey());
  storage.setItem(storageKey, JSON.stringify({ privateKey, version: 1 } satisfies StoredGameplayKey));
  return { privateKey, publicKey: getStarkKey(privateKey) };
}

export function getStoredGameplayKey({
  storage,
  chainId,
  owner,
}: {
  storage: StorageLike;
  chainId: BigNumberish;
  owner: BigNumberish;
}): GameplayKey | null {
  const storageKey = gameplayKeyStorageKey(chainId, owner);
  const storedKey = storage.getItem(storageKey);
  return storedKey === null ? null : parseGameplayKey(storedKey, storageKey);
}

export function gameplayKeyStorageKey(chainId: BigNumberish, owner: BigNumberish): string {
  return `${GAMEPLAY_KEY_PREFIX}:${num.toHex(chainId)}:${addAddressPadding(num.toHex(owner))}`;
}

async function isGameplayAccountDeployed(
  provider: ProviderInterface,
  address: string,
  expectedClassHash: string,
): Promise<boolean> {
  try {
    const deployedClassHash = await provider.getClassHashAt(address);
    if (BigInt(deployedClassHash) !== BigInt(expectedClassHash)) {
      throw new Error(`Gameplay account ${address} has unexpected class hash ${deployedClassHash}`);
    }
    return true;
  } catch (error) {
    if (rpcErrorCode(error) === CONTRACT_NOT_FOUND) {
      return false;
    }
    throw error;
  }
}

function calculateGameplayAccountAddress(
  classHash: string,
  addressSalt: string,
  constructorCalldata: [string, string, string],
): string {
  return addAddressPadding(hash.calculateContractAddressFromHash(addressSalt, classHash, constructorCalldata, 0));
}

function assertGuestAllowed(chain: GameChain, owner: BigNumberish): void {
  if (BigInt(owner) === 0n && chain !== "madara") {
    throw new Error("Guest gameplay accounts are only allowed on madara");
  }
}

function parseGameplayKey(serialized: string, storageKey: string): GameplayKey {
  let record: unknown;
  try {
    record = JSON.parse(serialized);
  } catch {
    throw new Error(`Invalid gameplay key record at ${storageKey}`);
  }

  if (!isStoredGameplayKey(record)) {
    throw new Error(`Invalid gameplay key record at ${storageKey}`);
  }

  try {
    return { privateKey: record.privateKey, publicKey: getStarkKey(record.privateKey) };
  } catch {
    throw new Error(`Invalid gameplay private key at ${storageKey}`);
  }
}

function isStoredGameplayKey(value: unknown): value is StoredGameplayKey {
  return (
    typeof value === "object" &&
    value !== null &&
    "version" in value &&
    value.version === 1 &&
    "privateKey" in value &&
    typeof value.privateKey === "string"
  );
}

function rpcErrorCode(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return undefined;
  }
  return typeof error.code === "number" ? error.code : undefined;
}

function bytesToHex(bytes: Uint8Array): string {
  return `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}
