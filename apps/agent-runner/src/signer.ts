import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DeviceSigner,
  deviceKeyOf,
  joinRealmsAccount,
  keyGuardian,
  signGameplayIntent,
  type DeviceKey,
  type GameClient,
} from "@bibliothecadao/eternum";
import { configureGameplayAccountSubmits, type Shard } from "@bibliothecadao/eternum/game-client";
import { Account, BlockTag, RpcProvider, stark, type AccountInterface } from "starknet";

import { resolveDataDir, type RunnerConfig, type RunnerSigner } from "./config";

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
      ? await connectGuestAccount(shard, provider, dataDir)
      : connectKeyAccount(config.signer, provider);
  // Every send, raw or through the client's provider, takes the gameplay nonce and fee path.
  const signer = configureGameplayAccountSubmits(account, shard.chainId);
  client.connect(signer);
  return signer;
}

/**
 * A guest is a Realms account that guards itself: its one key is its guardian and its only device, and its public key
 * names it. The key persists under the data dir so a restarted runner is the same player.
 */
const connectGuestAccount = async (shard: Shard, provider: RpcProvider, dataDir: string): Promise<Account> => {
  const key = await loadOrMintGuestKey(dataDir);
  return joinRealmsAccount({
    provider,
    shard: { chainId: shard.chainId, accountClassHash: shard.accountClassHash, guardianPublicKey: key.publicKey },
    realmsId: key.publicKey,
    device: key,
    approve: keyGuardian(key.privateKey),
  });
};

const connectKeyAccount = (signer: Extract<RunnerSigner, { mode: "key" }>, provider: RpcProvider): Account =>
  new Account({
    provider,
    address: signer.gameplayAccountAddress,
    signer: new DeviceSigner(deviceKeyOf(signer.gameplayPrivateKey)),
    cairoVersion: "1",
  });

const loadOrMintGuestKey = async (dataDir: string): Promise<DeviceKey> => {
  const file = path.join(dataDir, GUEST_KEY_FILE);
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
  if (typeof record.privateKey !== "string") throw new Error(`Guest key file ${file} has no privateKey`);
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
  const key = await readStoredKey(path.join(resolveDataDir(config, gameId), GUEST_KEY_FILE));
  if (!key) throw new Error("The guest gameplay key is missing");
  return signGameplayIntent(digest, key.privateKey);
}
