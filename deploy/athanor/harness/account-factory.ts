import { setTimeout as delay } from "node:timers/promises";
import { serviceFailure } from "../../../packages/value-ledger/src/service-error";
import { stark, type Account, type RpcProvider } from "starknet";
import { deviceKeyOf, joinBotAccount, type OperatorIdentity, type RealmsAccountShard } from "@bibliothecadao/eternum";
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
  provider: RpcProvider;
  shard: RealmsAccountShard & GameplayShard;
  /** The run the bots play for: their sends stop being reconciled when it ends. */
  stopped?: AbortSignal;
}

const DEFAULT_DEPLOY_CONCURRENCY = 12;

/** Bots are Realms accounts under the shard's own guardian, each device approved through the operator route. */
export async function createHarnessAccounts({
  concurrency = DEFAULT_DEPLOY_CONCURRENCY,
  count,
  gameId,
  identity,
  provider,
  shard,
  stopped,
}: CreateHarnessAccountsOptions): Promise<HarnessAccount[]> {
  const botIds = Array.from({ length: count }, (_, botId) => botId);
  return mapWithConcurrency(botIds, concurrency, async (botId) => {
    const privateKey = stark.randomAddress();
    const device = deviceKeyOf(privateKey);
    const startedAt = performance.now();

    try {
      // Every send a bot makes, raw or through the client's provider, takes the client's nonce and fee path.
      const account = configureGameplayAccountSubmits(
        await joinRateLimitedBot({ provider, shard, label: stark.randomAddress(), device, identity }, stopped),
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
  });
}

/** The public proxy allows 30 account operations per minute; a refused join retries the same account and device for at most two windows. */
async function joinRateLimitedBot(
  input: Parameters<typeof joinBotAccount>[0],
  stopped?: AbortSignal,
): Promise<Account> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await joinBotAccount(input);
    } catch (error) {
      let cause = error;
      while (cause instanceof Error && cause.cause) cause = cause.cause;
      if (attempt === 2 || !cause || typeof cause !== "object" || !("code" in cause) || cause.code !== -32005)
        throw error;
      console.log("Bot sign-in reached the public account-operation limit; waiting for its one-minute window.");
      await delay(60_000, undefined, { signal: stopped });
    }
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
