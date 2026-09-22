import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  bindGameplayAccounts,
  connectGameplayAccount,
  ensureGameplayAccount,
  signGameplayIntent,
  type GameClient,
} from "@bibliothecadao/eternum";
import { configureGameplayAccountSubmits, type Shard } from "@bibliothecadao/eternum/game-client";
import { Account, BlockTag, ec, RpcProvider, stark, type AccountInterface } from "starknet";

import { resolveDataDir, type RunnerConfig, type RunnerSigner } from "./config";

interface GameplayKey {
  privateKey: string;
  publicKey: string;
}

const GUEST_KEY_FILE = "guest-key.json";

/** The account the runner plays as, connected to the client; null in spectate mode. */
export async function resolveRunnerSigner(
  config: RunnerConfig,
  client: GameClient,
  dataDir: string,
): Promise<AccountInterface | null> {
  if (config.signer.mode === "none") return null;
  const { shard } = client;
  const provider = new RpcProvider({ nodeUrl: shard.rpcUrl, blockIdentifier: BlockTag.PRE_CONFIRMED });
  const account =
    config.signer.mode === "guest"
      ? await connectGuestAccount(shard, config.signer, provider, dataDir)
      : await connectKeyAccount(shard, config.signer, provider);
  // Every send, raw or through the client's provider, takes the gameplay nonce and fee path.
  const signer = configureGameplayAccountSubmits(account, shard.chainId);
  client.connect(signer);
  return signer;
}

/**
 * A guest owns itself: the account deploys with no owner and is bound to its own address, which is what settlement
 * keys on. The key persists under the data dir so a restarted runner is the same player.
 */
const connectGuestAccount = async (
  shard: Shard,
  signer: Extract<RunnerSigner, { mode: "guest" }>,
  provider: RpcProvider,
  dataDir: string,
): Promise<Account> => {
  const key = await loadOrMintGuestKey(dataDir);
  const authority = requireShardContract(shard, "bindingAuthority");
  const account = await ensureGameplayAccount({
    authority,
    classHash: shard.accountClassHash,
    owner: "0x0",
    privateKey: key.privateKey,
    provider,
    publicKey: key.publicKey,
  });
  await bindGameplayAccounts({
    accounts: [{ owner: account.address, address: account.address }],
    authority: new Account({
      provider,
      address: authority,
      signer: signer.bindingAuthorityPrivateKey,
    }),
    playerRegistryAddress: requireShardContract(shard, "playerRegistry"),
    provider,
  });
  return account;
};

const connectKeyAccount = (
  shard: Shard,
  signer: Extract<RunnerSigner, { mode: "key" }>,
  provider: RpcProvider,
): Promise<Account> =>
  connectGameplayAccount({
    address: signer.gameplayAccountAddress,
    classHash: shard.accountClassHash,
    privateKey: signer.gameplayPrivateKey,
    provider,
  });

const requireShardContract = (shard: Shard, name: string): string => {
  const address = shard.contracts[name];
  if (!address) throw new Error(`Shard ${shard.url} names no ${name} contract`);
  return address;
};

const loadOrMintGuestKey = async (dataDir: string): Promise<GameplayKey> => {
  const file = path.join(dataDir, GUEST_KEY_FILE);
  const stored = await readStoredKey(file);
  if (stored) return stored;
  const key = gameplayKey(stark.randomAddress());
  await mkdir(dataDir, { recursive: true });
  await writeFile(file, JSON.stringify({ privateKey: key.privateKey }), { mode: 0o600 });
  return key;
};

const readStoredKey = async (file: string): Promise<GameplayKey | null> => {
  let raw: string;
  try {
    raw = await readFile(file, "utf8");
  } catch {
    return null;
  }
  const record = JSON.parse(raw) as { privateKey?: unknown };
  if (typeof record.privateKey !== "string") throw new Error(`Guest key file ${file} has no privateKey`);
  return gameplayKey(record.privateKey);
};

const gameplayKey = (privateKey: string): GameplayKey => ({
  privateKey,
  publicKey: ec.starkCurve.getStarkKey(privateKey),
});

/** The same persisted gameplay key signs action commitments; no separate action key is created. */
export async function signRunnerIntent(
  config: RunnerConfig,
  gameId: number,
  actor: AccountInterface,
  digest: string,
): Promise<string[]> {
  if (config.signer.mode === "none") throw new Error("A spectator cannot sign an action");
  if (config.signer.mode === "key") {
    if (BigInt(actor.address) !== BigInt(config.signer.gameplayAccountAddress))
      throw new Error("Gameplay identity changed before signing");
    return signGameplayIntent(digest, config.signer.gameplayPrivateKey);
  }
  const key = await readStoredKey(path.join(resolveDataDir(config, gameId), GUEST_KEY_FILE));
  if (!key) throw new Error("The guest gameplay key is missing");
  return signGameplayIntent(digest, key.privateKey);
}
