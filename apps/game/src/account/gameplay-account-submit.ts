import { resolveGameTransactionResourceBounds } from "@bibliothecadao/eternum";
import { extractErrorMessage } from "@bibliothecadao/provider/errors";
import type { GameChain } from "@realms-world/chain";
import {
  BlockTag,
  type Account,
  type AllowArray,
  type Call,
  type InvokeFunctionResponse,
  type UniversalDetails,
} from "starknet";

type GameplaySubmitAccount = Pick<Account, "address" | "execute" | "getNonce">;
type RawExecute = (calls: AllowArray<Call>, details?: UniversalDetails) => Promise<InvokeFunctionResponse>;

interface ConfiguredGameplaySubmit {
  chain: GameChain;
  execute: RawExecute;
}

interface ExecuteGameplayAccountTransactionOptions {
  account: GameplaySubmitAccount;
  calls: AllowArray<Call>;
  chain: GameChain;
  details?: UniversalDetails;
}

const configuredGameplaySubmits = new WeakMap<object, ConfiguredGameplaySubmit>();
const accountSubmitTails = new Map<string, Promise<void>>();

export function configureGameplayAccountSubmits(account: Account, chain: GameChain): Account {
  const configured = configuredGameplaySubmits.get(account);
  if (configured) {
    assertConfiguredChain(account.address, configured.chain, chain);
    return account;
  }

  configuredGameplaySubmits.set(account, {
    chain,
    execute: account.execute.bind(account),
  });
  account.execute = ((calls: AllowArray<Call>, details?: UniversalDetails) =>
    executeGameplayAccountTransaction({ account, calls, chain, details })) as Account["execute"];
  return account;
}

export function executeGameplayAccountTransaction({
  account,
  calls,
  chain,
  details,
}: ExecuteGameplayAccountTransactionOptions): Promise<InvokeFunctionResponse> {
  const configured = configuredGameplaySubmits.get(account);
  if (configured) assertConfiguredChain(account.address, configured.chain, chain);

  const execute = configured?.execute ?? account.execute.bind(account);
  return runSerializedGameplayAccountSubmit(`${chain}:${account.address.toLowerCase()}`, () =>
    executeWithCurrentNonce({ account, calls, chain, details, execute }),
  );
}

function assertConfiguredChain(address: string, configuredChain: GameChain, requestedChain: GameChain): void {
  if (configuredChain !== requestedChain) {
    throw new Error(`Gameplay account ${address} is configured for ${configuredChain}, not ${requestedChain}`);
  }
}

function runSerializedGameplayAccountSubmit<T>(key: string, submit: () => Promise<T>): Promise<T> {
  const previous = accountSubmitTails.get(key) ?? Promise.resolve();
  const result = previous.then(submit, submit);
  const tail = result.then(
    () => undefined,
    () => undefined,
  );
  accountSubmitTails.set(key, tail);
  void tail.finally(() => {
    if (accountSubmitTails.get(key) === tail) accountSubmitTails.delete(key);
  });
  return result;
}

async function executeWithCurrentNonce({
  account,
  calls,
  chain,
  details,
  execute,
}: ExecuteGameplayAccountTransactionOptions & { execute: RawExecute }): Promise<InvokeFunctionResponse> {
  try {
    return await executeOnceWithCurrentNonce({ account, calls, chain, details, execute });
  } catch (error) {
    if (!isNonceRejection(error)) throw error;
    return executeOnceWithCurrentNonce({ account, calls, chain, details, execute });
  }
}

async function executeOnceWithCurrentNonce({
  account,
  calls,
  chain,
  details,
  execute,
}: ExecuteGameplayAccountTransactionOptions & { execute: RawExecute }): Promise<InvokeFunctionResponse> {
  const nonce = await account.getNonce(BlockTag.PRE_CONFIRMED);
  const resourceBounds = resolveGameTransactionResourceBounds(chain);
  return execute(calls, {
    ...details,
    nonce,
    tip: 0,
    ...(resourceBounds ? { resourceBounds } : {}),
  });
}

function isNonceRejection(error: unknown): boolean {
  const message = extractErrorMessage(error, "");
  return /nonce/i.test(message) && /(already|expected|got|invalid|mismatch|too high|too low)/i.test(message);
}
