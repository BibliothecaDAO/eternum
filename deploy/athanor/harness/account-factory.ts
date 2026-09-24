import { ec, stark, type Account, type RpcProvider } from "starknet";
import { deviceKeyOf, joinRealmsAccount, keyGuardian } from "@bibliothecadao/eternum";
import { configureGameplayAccountSubmits } from "@bibliothecadao/eternum/game-client";

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
  classHash: string;
  concurrency?: number;
  count: number;
  gameId: number;
  provider: RpcProvider;
}

const DEFAULT_DEPLOY_CONCURRENCY = 12;

/** Bots are Realms accounts under one throwaway guardian per run; our guardian never approves a bot. */
export async function createHarnessAccounts({
  classHash,
  concurrency = DEFAULT_DEPLOY_CONCURRENCY,
  count,
  gameId,
  provider,
}: CreateHarnessAccountsOptions): Promise<HarnessAccount[]> {
  const chainId = await provider.getChainId();
  const guardianKey = stark.randomAddress();
  const shard = { chainId, accountClassHash: classHash, guardianPublicKey: ec.starkCurve.getStarkKey(guardianKey) };
  const botIds = Array.from({ length: count }, (_, botId) => botId);
  return mapWithConcurrency(botIds, concurrency, async (botId) => {
    const privateKey = stark.randomAddress();
    const device = deviceKeyOf(privateKey);
    const startedAt = performance.now();

    try {
      // Every send a bot makes, raw or through the client's provider, takes the client's nonce and fee path.
      const account = configureGameplayAccountSubmits(
        await joinRealmsAccount({
          provider,
          shard,
          realmsId: stark.randomAddress(),
          device,
          approve: keyGuardian(guardianKey),
        }),
        chainId,
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
      throw new Error(`Failed to deploy gameplay account for bot ${botId}`, { cause: error });
    }
  });
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
