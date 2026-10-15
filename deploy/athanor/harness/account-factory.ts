import { serviceFailure } from "../../../packages/value-ledger/src/service-error";
import { Account, stark, type RpcProvider } from "starknet";
import {
  DeviceSigner,
  deviceKeyOf,
  joinBotAccount,
  type OperatorIdentity,
  type RealmsAccountShard,
} from "@bibliothecadao/eternum";
import { configureGameplayAccountSubmits, type GameplayShard } from "@bibliothecadao/eternum/game-client";

export interface HarnessAccount {
  account: Account;
  address: string;
  botId: number;
  deployedInMs: number;
  gameId: number;
  owner: string;
  privateKey: string;
  publicKey: string;
}

interface CreateHarnessAccountsOptions {
  concurrency?: number;
  count: number;
  gameId: number;
  identity: OperatorIdentity;
  /** The private node: bots join there, like every setup and administrative call. */
  setupProvider: RpcProvider;
  /** The public stamping RPC: the joined accounts play through it, as players do. */
  playProvider: RpcProvider;
  shard: RealmsAccountShard & GameplayShard;
  /** The run the bots play for: their sends stop being reconciled when it ends. */
  stopped?: AbortSignal;
}

const DEFAULT_DEPLOY_CONCURRENCY = 12;
/** A bot's sign-in crosses the identity Worker; one dropped request must not end a 2,000-bot run. */
const JOIN_ATTEMPTS = 3;

/** Bots are Realms accounts under the shard's own guardian, each device approved through the operator route. */
export async function createHarnessAccounts({
  concurrency = DEFAULT_DEPLOY_CONCURRENCY,
  ...options
}: CreateHarnessAccountsOptions): Promise<HarnessAccount[]> {
  const botIds = Array.from({ length: options.count }, (_, botId) => botId);
  return mapWithConcurrency(botIds, concurrency, (botId) => joinHarnessBotWithRetry(botId, options));
}

/** Each attempt is a fresh account (new key and label), so a retry never replays a half-finished join. */
async function joinHarnessBotWithRetry(
  botId: number,
  options: Omit<CreateHarnessAccountsOptions, "concurrency">,
): Promise<HarnessAccount> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await joinHarnessBot(botId, options);
    } catch (error) {
      if (attempt === JOIN_ATTEMPTS) throw error;
      console.error(`${(error as Error).message}; attempt ${attempt + 1} of ${JOIN_ATTEMPTS} with a fresh account`);
    }
  }
}

async function joinHarnessBot(
  botId: number,
  { gameId, identity, setupProvider, playProvider, shard, stopped }: Omit<CreateHarnessAccountsOptions, "concurrency">,
): Promise<HarnessAccount> {
  const privateKey = stark.randomAddress();
  const device = deviceKeyOf(privateKey);
  const startedAt = performance.now();

  try {
    const joined = await joinBotAccount({
      provider: setupProvider,
      shard,
      label: stark.randomAddress(),
      device,
      identity,
    });
    // Every send a bot makes, raw or through the client's provider, takes the client's nonce and fee path.
    const account = configureGameplayAccountSubmits(
      new Account({
        provider: playProvider,
        address: joined.address,
        signer: new DeviceSigner(device),
        cairoVersion: "1",
      }),
      shard,
      stopped,
    );

    return {
      account,
      address: account.address,
      botId,
      deployedInMs: elapsedMs(startedAt),
      gameId,
      owner: account.address,
      privateKey,
      publicKey: device.publicKey,
    };
  } catch (error) {
    const failure = serviceFailure(error, [], "bot_account_join_failed", [privateKey, identity.operatorToken]);
    throw new Error(`Bot ${botId} sign-in failed: ${failure.type}: ${failure.message}`, { cause: error });
  }
}

export async function mapWithConcurrency<T, R>(
  values: readonly T[],
  concurrency: number,
  mapper: (value: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error(`Concurrency must be a positive integer, received ${concurrency}`);
  }

  const results = new Array<R>(values.length);
  let nextIndex = 0;

  const worker = async () => {
    for (;;) {
      const index = nextIndex++;
      if (index >= values.length) return;
      results[index] = await mapper(values[index]!, index);
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, worker));
  return results;
}

function elapsedMs(startedAt: number): number {
  return Math.round(performance.now() - startedAt);
}
