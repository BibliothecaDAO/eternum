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

interface GameplayAccountSubmitState {
  nextNonce?: bigint;
  tail: Promise<void>;
}

interface ExecuteGameplayAccountTransactionOptions {
  account: GameplaySubmitAccount;
  calls: AllowArray<Call>;
  chain: GameChain;
  details?: UniversalDetails;
}

const configuredGameplaySubmits = new WeakMap<object, ConfiguredGameplaySubmit>();
const accountSubmitStates = new Map<string, GameplayAccountSubmitState>();

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
  return runSerializedGameplayAccountSubmit(`${chain}:${account.address.toLowerCase()}`, (state) =>
    executeWithDispensedNonce({ account, calls, chain, details, execute, state }),
  );
}

function assertConfiguredChain(address: string, configuredChain: GameChain, requestedChain: GameChain): void {
  if (configuredChain !== requestedChain) {
    throw new Error(`Gameplay account ${address} is configured for ${configuredChain}, not ${requestedChain}`);
  }
}

function runSerializedGameplayAccountSubmit<T>(
  key: string,
  submit: (state: GameplayAccountSubmitState) => Promise<T>,
): Promise<T> {
  const state = accountSubmitStates.get(key) ?? { tail: Promise.resolve() };
  accountSubmitStates.set(key, state);
  const result = state.tail.then(
    () => submit(state),
    () => submit(state),
  );
  const tail = result.then(
    () => undefined,
    () => undefined,
  );
  state.tail = tail;
  return result;
}

async function executeWithDispensedNonce({
  account,
  calls,
  chain,
  details,
  execute,
  state,
}: ExecuteGameplayAccountTransactionOptions & {
  execute: RawExecute;
  state: GameplayAccountSubmitState;
}): Promise<InvokeFunctionResponse> {
  try {
    return await executeOnceWithDispensedNonce({ account, calls, chain, details, execute, state });
  } catch (error) {
    if (!isNonceRejection(error)) throw error;
    state.nextNonce = undefined;
    return executeOnceWithDispensedNonce({ account, calls, chain, details, execute, state });
  }
}

async function executeOnceWithDispensedNonce({
  account,
  calls,
  chain,
  details,
  execute,
  state,
}: ExecuteGameplayAccountTransactionOptions & {
  execute: RawExecute;
  state: GameplayAccountSubmitState;
}): Promise<InvokeFunctionResponse> {
  const nonce = state.nextNonce ?? BigInt(await account.getNonce(BlockTag.PRE_CONFIRMED));
  const resourceBounds = resolveGameTransactionResourceBounds(chain);
  const result = await execute(calls, {
    ...details,
    nonce,
    tip: 0,
    ...(resourceBounds ? { resourceBounds } : {}),
  });
  state.nextNonce = nonce + 1n;
  return result;
}

function isNonceRejection(error: unknown): boolean {
  const message = extractErrorMessage(error, "");
  return /nonce/i.test(message) && /(already|expected|got|invalid|mismatch|too high|too low)/i.test(message);
}
