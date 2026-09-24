import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DeviceSigner,
  deviceKeyOf,
  joinBotAccount,
  signGameplayIntent,
  type DeviceKey,
  type GameClient,
} from "@bibliothecadao/eternum";
import { configureGameplayAccountSubmits, type Shard } from "@bibliothecadao/eternum/game-client";
import { Account, BlockTag, RpcProvider, stark, type AccountInterface } from "starknet";

import { resolveDataDir, type RunnerConfig, type RunnerSigner } from "./config";

const BOT_KEY_FILE = "bot-key.json";

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
    config.signer.mode === "bot"
      ? await connectBotAccount(config.signer, shard, provider, dataDir)
      : connectKeyAccount(config.signer, provider);
  // Every send, raw or through the client's provider, takes the gameplay nonce and fee path.
  const signer = configureGameplayAccountSubmits(account, shard.chainId);
  client.connect(signer);
  return signer;
}

/**
 * A bot is a Realms account under the shard's guardian, named by its device key and approved through the identity
 * Worker's operator route. The key persists under the data dir so a restarted runner is the same player.
 */
const connectBotAccount = async (
  signer: Extract<RunnerSigner, { mode: "bot" }>,
  shard: Shard,
  provider: RpcProvider,
  dataDir: string,
): Promise<Account> => {
  const key = await loadOrMintBotKey(dataDir);
  return joinBotAccount({
    provider,
    shard,
    label: key.publicKey,
    device: key,
    identity: { url: signer.identityUrl, operatorToken: signer.operatorToken },
  });
};

const connectKeyAccount = (signer: Extract<RunnerSigner, { mode: "key" }>, provider: RpcProvider): Account =>
  new Account({
    provider,
    address: signer.gameplayAccountAddress,
    signer: new DeviceSigner(deviceKeyOf(signer.gameplayPrivateKey)),
    cairoVersion: "1",
  });

const loadOrMintBotKey = async (dataDir: string): Promise<DeviceKey> => {
  const file = path.join(dataDir, BOT_KEY_FILE);
  const stored = await readStoredKey(file);
  if (stored) return stored;
  const key = deviceKeyOf(stark.randomAddress());
  await mkdir(dataDir, { recursive: true });
  await writeFile(file, JSON.stringify({ privateKey: key.privateKey }), { mode: 0o600 });
  return key;
};

const readStoredKey = async (file: string): Promise<DeviceKey | null> => {
  let raw: string;
  try {
    raw = await readFile(file, "utf8");
  } catch {
    return null;
  }
  const record = JSON.parse(raw) as { privateKey?: unknown };
  if (typeof record.privateKey !== "string") throw new Error(`Bot key file ${file} has no privateKey`);
  return deviceKeyOf(record.privateKey);
};

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
  const key = await readStoredKey(path.join(resolveDataDir(config, gameId), BOT_KEY_FILE));
  if (!key) throw new Error("The bot gameplay key is missing");
  return signGameplayIntent(digest, key.privateKey);
}
