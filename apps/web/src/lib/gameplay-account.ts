import { z } from "zod";

import { resolveEndpoint } from "@realms-world/chain";
import { Account, RpcProvider, num } from "starknet";

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
  rpcUrl: string;
}

type GameplayContractReader = Pick<RpcProvider, "callContract" | "getClassHashAt">;

export async function bindGameplayAccount({
  owner,
  gameplayAddress,
  publicKey,
}: z.infer<typeof BindGameplayAccountInput> & { owner: string }) {
  const config = gameplayAccountServerConfig();
  const provider = createGameProvider(config);

  await assertBindableGameplayAccount({
    provider,
    expectedAuthority: config.authorityAddress,
    expectedClassHash: config.classHash,
    gameplayAddress,
    owner,
    publicKey,
  });

  const currentAccount = await readContractAddress(provider, config.registryAddress, "account_of", owner);
  if (BigInt(currentAccount) !== 0n) {
    if (sameStarknetValue(currentAccount, gameplayAddress)) {
      return { account: num.toHex(gameplayAddress), bound: false as const };
    }
    throw new Error(`Identity ${owner} already has a gameplay account`);
  }

  const transactionHash = await executeAuthorityCall(config, provider, {
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
  const provider = createGameProvider(config);
  const gameplayAddress = await readContractAddress(provider, config.registryAddress, "account_of", owner);
  if (BigInt(gameplayAddress) === 0n) {
    throw new Error(`Identity ${owner} has no gameplay account`);
  }

  const transactionHash = await executeAuthorityCall(config, provider, {
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
    registryAddress: requiredServerValue("PLAYER_REGISTRY_ADDRESS"),
    rpcUrl: resolveEndpoint(process.env.GAME_RPC_URL, {
      name: "GAME_RPC_URL",
      browserFacing: false,
    }),
  };
}

function createGameProvider(config: GameplayAccountServerConfig): RpcProvider {
  return new RpcProvider({ nodeUrl: config.rpcUrl });
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
  provider: GameplayContractReader,
  contractAddress: string,
  entrypoint: string,
  ...calldata: string[]
): Promise<string> {
  const [value] = await provider.callContract({ contractAddress, entrypoint, calldata });
  if (value === undefined) {
    throw new Error(`${entrypoint} returned no value for ${contractAddress}`);
  }
  return value;
}

async function executeAuthorityCall(
  config: GameplayAccountServerConfig,
  provider: RpcProvider,
  call: { contractAddress: string; entrypoint: string; calldata: string[] },
): Promise<string> {
  const authority = new Account({
    provider,
    address: config.authorityAddress,
    signer: config.authorityPrivateKey,
    cairoVersion: "1",
  });
  const transaction = await authority.execute(call);
  await provider.waitForTransaction(transaction.transaction_hash);
  return transaction.transaction_hash;
}

function requiredServerValue(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function sameStarknetValue(left: string, right: string): boolean {
  return BigInt(left) === BigInt(right);
}
