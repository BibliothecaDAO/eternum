import { ec, stark, type Account, type RpcProvider } from "starknet";
import { ensureGameplayAccount } from "../../../packages/core/src/account/gameplay-account";

export interface HarnessAccount {
  account: Account;
  address: string;
  botId: number;
  deployedInMs: number;
  privateKey: string;
  publicKey: string;
}

interface CreateHarnessAccountsOptions {
  authority: string;
  classHash: string;
  concurrency?: number;
  count: number;
  provider: RpcProvider;
}

const DEFAULT_DEPLOY_CONCURRENCY = 12;

export async function createHarnessAccounts({
  authority,
  classHash,
  concurrency = DEFAULT_DEPLOY_CONCURRENCY,
  count,
  provider,
}: CreateHarnessAccountsOptions): Promise<HarnessAccount[]> {
  const botIds = Array.from({ length: count }, (_, botId) => botId);

  return mapWithConcurrency(botIds, concurrency, async (botId) => {
    const { privateKey, publicKey } = createHarnessKey();
    const startedAt = performance.now();

    try {
      const account = await ensureGameplayAccount({
        authority,
        classHash,
        owner: 0,
        privateKey,
        provider,
        publicKey,
      });

      return {
        account,
        address: account.address,
        botId,
        deployedInMs: elapsedMs(startedAt),
        privateKey,
        publicKey,
      };
    } catch (error) {
      throw new Error(`Failed to deploy gameplay account for bot ${botId}`, { cause: error });
    }
  });
}

function createHarnessKey(): { privateKey: string; publicKey: string } {
  const privateKey = stark.randomAddress();
  return { privateKey, publicKey: ec.starkCurve.getStarkKey(privateKey) };
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
