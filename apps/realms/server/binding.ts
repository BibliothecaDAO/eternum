import { resolveEndpoint } from "@realms-world/chain";
import { Account, RpcProvider, num } from "starknet";
import { z } from "zod";

import { serverEnv } from "./env";

const provider = new RpcProvider({
  nodeUrl: resolveEndpoint(serverEnv.GAME_RPC_URL, { name: "GAME_RPC_URL", browserFacing: false }),
});

const StarknetValue = z.string().regex(/^0x[0-9a-fA-F]+$/);
export const BindGameplayAccountInput = z.object({
  gameplayAddress: StarknetValue,
  publicKey: StarknetValue,
});
export const RotateGameplayAccountInput = z.object({ publicKey: StarknetValue });

interface GameplayAccountServerConfig {
  authorityAddress: string;
  authorityPrivateKey: string;
  classHash: string;
  registryAddress: string;
}

type GameplayContractReader = Pick<RpcProvider, "callContract" | "getClassHashAt">;
type AuthorityCall<T> = () => Promise<T>;

let authorityCallTail: Promise<void> = Promise.resolve();

/**
 * The gameplay-account binding as a status: PlayerRegistry.account_of(owner)
 * on the game chain, read server-side so the browser never talks to the L3.
 */
export const gameplayAccountOf = async (owner: string): Promise<string | null> => {
  const [account] = await provider.callContract({
    contractAddress: serverEnv.PLAYER_REGISTRY_ADDRESS,
    entrypoint: "account_of",
    calldata: [owner],
  });
  if (account === undefined) throw new Error(`account_of returned no value for ${owner}`);
  if (BigInt(account) === 0n) return null;
  return account;
};

export async function bindGameplayAccount({
  owner,
  gameplayAddress,
  publicKey,
}: z.infer<typeof BindGameplayAccountInput> & { owner: string }) {
  const config = gameplayAccountServerConfig();

  await assertBindableGameplayAccount({
    provider,
    expectedAuthority: config.authorityAddress,
    expectedClassHash: config.classHash,
    gameplayAddress,
    owner,
    publicKey,
  });

  const currentAccount = await gameplayAccountOf(owner);
  if (currentAccount) {
    if (sameStarknetValue(currentAccount, gameplayAddress)) {
      return { account: num.toHex(gameplayAddress), bound: false as const };
    }
    throw new Error(`Identity ${owner} already has a gameplay account`);
  }

  const transactionHash = await executeAuthorityCall(config, {
    contractAddress: config.registryAddress,
    entrypoint: "bind",
    calldata: [owner, gameplayAddress],
  });

  return { account: num.toHex(gameplayAddress), bound: true as const, transactionHash };
}

export async function rotateGameplayAccountKey({
  owner,
  publicKey,
  sessionId,
}: z.infer<typeof RotateGameplayAccountInput> & { owner: string; sessionId: string }) {
  const config = gameplayAccountServerConfig();
  const gameplayAddress = await gameplayAccountOf(owner);
  if (!gameplayAddress) throw new Error(`Identity ${owner} has no gameplay account`);

  const transactionHash = await executeAuthorityCall(config, {
    contractAddress: gameplayAddress,
    entrypoint: "rotate_public_key",
    calldata: [publicKey],
  });

  console.info("gameplay_account_key_rotated", {
    account: num.toHex(gameplayAddress),
    owner,
    sessionId,
    transactionHash,
  });

  return { account: num.toHex(gameplayAddress), transactionHash };
}

function gameplayAccountServerConfig(): GameplayAccountServerConfig {
  return {
    authorityAddress: requiredServerValue("BINDING_AUTHORITY_ADDRESS"),
    authorityPrivateKey: requiredServerValue("BINDING_AUTHORITY_PRIVATE_KEY"),
    classHash: requiredServerValue("GAMEPLAY_ACCOUNT_CLASS_HASH"),
    registryAddress: serverEnv.PLAYER_REGISTRY_ADDRESS,
  };
}

export async function assertBindableGameplayAccount({
  provider,
  expectedAuthority,
  expectedClassHash,
  gameplayAddress,
  owner,
  publicKey,
}: {
  provider: GameplayContractReader;
  expectedAuthority: string;
  expectedClassHash: string;
  gameplayAddress: string;
  owner: string;
  publicKey: string;
}): Promise<void> {
  const classHash = await provider.getClassHashAt(gameplayAddress);
  if (!sameStarknetValue(classHash, expectedClassHash)) {
    throw new Error(`Contract ${gameplayAddress} is not a RealmsPlayerAccount`);
  }

  const accountOwner = await readContractAddress(provider, gameplayAddress, "owner");
  if (!sameStarknetValue(accountOwner, owner)) {
    throw new Error(`Gameplay account ${gameplayAddress} belongs to another identity`);
  }

  const accountPublicKey = await readContractAddress(provider, gameplayAddress, "get_public_key");
  if (!sameStarknetValue(accountPublicKey, publicKey)) {
    throw new Error(`Gameplay account ${gameplayAddress} has another public key`);
  }

  const bindingAuthority = await readContractAddress(provider, gameplayAddress, "binding_authority");
  if (!sameStarknetValue(bindingAuthority, expectedAuthority)) {
    throw new Error(`Gameplay account ${gameplayAddress} has another binding authority`);
  }
}

async function readContractAddress(
  reader: GameplayContractReader,
  contractAddress: string,
  entrypoint: string,
  ...calldata: string[]
): Promise<string> {
  const [value] = await reader.callContract({ contractAddress, entrypoint, calldata });
  if (value === undefined) throw new Error(`${entrypoint} returned no value for ${contractAddress}`);
  return value;
}

async function executeAuthorityCall(
  config: GameplayAccountServerConfig,
  call: { contractAddress: string; entrypoint: string; calldata: string[] },
): Promise<string> {
  return runSerializedAuthorityCall(async () => {
    const authority = new Account({
      provider,
      address: config.authorityAddress,
      signer: config.authorityPrivateKey,
      cairoVersion: "1",
    });
    const transaction = await authority.execute(call);
    await provider.waitForTransaction(transaction.transaction_hash);
    return transaction.transaction_hash;
  });
}

export function runSerializedAuthorityCall<T>(call: AuthorityCall<T>): Promise<T> {
  const result = authorityCallTail.then(
    () => runAuthorityCallWithNonceRetry(call),
    () => runAuthorityCallWithNonceRetry(call),
  );
  authorityCallTail = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

async function runAuthorityCallWithNonceRetry<T>(call: AuthorityCall<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    if (!isNonceRejection(error)) throw error;
    return call();
  }
}

function isNonceRejection(error: unknown): boolean {
  const message = authorityErrorText(error);
  return /nonce/i.test(message) && /(already|expected|invalid|mismatch|too high|too low)/i.test(message);
}

function authorityErrorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function requiredServerValue(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function sameStarknetValue(left: string, right: string): boolean {
  return BigInt(left) === BigInt(right);
}
