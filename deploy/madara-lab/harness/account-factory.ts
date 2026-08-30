import { ec, stark, type Account, type RpcProvider } from "starknet";
import { ensureGameplayAccount } from "../../../packages/core/src/account/gameplay-account";

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

export interface HarnessGameplayIdentity {
  owner: string;
  privateKey: string;
}

interface CreateHarnessAccountsOptions {
  authority: string;
  classHash: string;
  concurrency?: number;
  count: number;
  gameId: number;
  identities?: readonly HarnessGameplayIdentity[];
  botIdOffset?: number;
  provider: RpcProvider;
}

const DEFAULT_DEPLOY_CONCURRENCY = 12;

export async function createHarnessAccounts({
  authority,
  classHash,
  concurrency = DEFAULT_DEPLOY_CONCURRENCY,
  count,
  gameId,
  identities,
  botIdOffset = 0,
  provider,
}: CreateHarnessAccountsOptions): Promise<HarnessAccount[]> {
  if (identities && identities.length !== count) {
    throw new Error(`Expected ${count} gameplay identities, received ${identities.length}`);
  }
  const botIds = Array.from({ length: count }, (_, botId) => botId + botIdOffset);

  return mapWithConcurrency(botIds, concurrency, async (botId, index) => {
    const identity = identities?.[index];
    const { privateKey, publicKey } = identity ? gameplayKey(identity.privateKey) : createHarnessKey();
    const owner = identity?.owner ?? "0x0";
    const startedAt = performance.now();

    try {
      const account = await ensureGameplayAccount({
        authority,
        classHash,
        owner,
        privateKey,
        provider,
        publicKey,
      });

      return {
        account,
        address: account.address,
        botId,
        deployedInMs: elapsedMs(startedAt),
        gameId,
        owner,
        privateKey,
        publicKey,
      };
    } catch (error) {
      throw new Error(`Failed to deploy gameplay account for bot ${botId}`, { cause: error });
    }
  });
}

function gameplayKey(privateKey: string): { privateKey: string; publicKey: string } {
  return { privateKey, publicKey: ec.starkCurve.getStarkKey(privateKey) };
}

function createHarnessKey(): { privateKey: string; publicKey: string } {
  return gameplayKey(stark.randomAddress());
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
