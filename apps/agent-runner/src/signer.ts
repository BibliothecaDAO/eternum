import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  bindGameplayAccounts,
  connectGameplayAccount,
  ensureGameplayAccount,
  type GameClient,
} from "@bibliothecadao/eternum";
import { configureGameplayAccountSubmits } from "@bibliothecadao/eternum/game-client";
import { Account, BlockTag, ec, RpcProvider, stark, type AccountInterface } from "starknet";

import type { RunnerConfig, RunnerSigner } from "./config";

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
  const provider = new RpcProvider({ nodeUrl: config.rpcUrl, blockIdentifier: BlockTag.PRE_CONFIRMED });
  const account =
    config.signer.mode === "guest"
      ? await connectGuestAccount(config, config.signer, provider, dataDir)
      : await connectKeyAccount(config, config.signer, provider);
  // Every send, raw or through the client's provider, takes the gameplay nonce and fee path.
  const signer = configureGameplayAccountSubmits(account, config.chain);
  client.connect(signer);
  return signer;
}

/**
 * A guest owns itself: the account deploys with no owner and is bound to its own address, which is what settlement
 * keys on. The key persists under the data dir so a restarted runner is the same player.
 */
const connectGuestAccount = async (
  config: RunnerConfig,
  signer: Extract<RunnerSigner, { mode: "guest" }>,
  provider: RpcProvider,
  dataDir: string,
): Promise<Account> => {
  const key = await loadOrMintGuestKey(dataDir);
  const account = await ensureGameplayAccount({
    authority: config.bindingAuthorityAddress,
    classHash: config.playerAccountClassHash,
    owner: "0x0",
    privateKey: key.privateKey,
    provider,
    publicKey: key.publicKey,
  });
  await bindGameplayAccounts({
    accounts: [{ owner: account.address, address: account.address }],
    authority: new Account({
      provider,
      address: config.bindingAuthorityAddress,
      signer: signer.bindingAuthorityPrivateKey,
    }),
    chain: config.chain,
    playerRegistryAddress: config.playerRegistryAddress,
    provider,
  });
  return account;
};

const connectKeyAccount = (
  config: RunnerConfig,
  signer: Extract<RunnerSigner, { mode: "key" }>,
  provider: RpcProvider,
): Promise<Account> =>
  connectGameplayAccount({
    address: signer.gameplayAccountAddress,
    classHash: config.playerAccountClassHash,
    privateKey: signer.gameplayPrivateKey,
    provider,
  });

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
