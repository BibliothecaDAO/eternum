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

/**
 * Nonces are dispensed locally so a burst of actions signs and sends in
 * parallel: waiting for the previous send to return before allocating the
 * next nonce cost one node round trip per action. `nextNonce` is unknown
 * before the first read and after any failed send (the failed nonce may be
 * unconsumed); while it is unknown, every waiting action shares one
 * pre-confirmed read.
 */
interface AccountNonceDispenser {
  nextNonce?: bigint;
  nonceRead?: Promise<void>;
}

interface ExecuteGameplayAccountTransactionOptions {
  account: GameplaySubmitAccount;
  calls: AllowArray<Call>;
  chain: GameChain;
  details?: UniversalDetails;
}

interface GameplaySubmit extends ExecuteGameplayAccountTransactionOptions {
  dispenser: AccountNonceDispenser;
  execute: RawExecute;
}

const configuredGameplaySubmits = new WeakMap<object, ConfiguredGameplaySubmit>();
const accountNonceDispensers = new Map<string, AccountNonceDispenser>();

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
  const dispenser = resolveNonceDispenser(`${chain}:${account.address.toLowerCase()}`);
  return submitWithLocalNonce({ account, calls, chain, details, dispenser, execute });
}

function assertConfiguredChain(address: string, configuredChain: GameChain, requestedChain: GameChain): void {
  if (configuredChain !== requestedChain) {
    throw new Error(`Gameplay account ${address} is configured for ${configuredChain}, not ${requestedChain}`);
  }
}

function resolveNonceDispenser(key: string): AccountNonceDispenser {
  const dispenser = accountNonceDispensers.get(key) ?? {};
  accountNonceDispensers.set(key, dispenser);
  return dispenser;
}

async function submitWithLocalNonce(submit: GameplaySubmit): Promise<InvokeFunctionResponse> {
  try {
    return await submitOnce(submit);
  } catch (error) {
    if (!isNonceRejection(error)) throw error;
    return submitOnce(submit);
  }
}

async function submitOnce({
  account,
  calls,
  chain,
  details,
  dispenser,
  execute,
}: GameplaySubmit): Promise<InvokeFunctionResponse> {
  const nonce = await takeNonce(account, dispenser);
  const resourceBounds = resolveGameTransactionResourceBounds(chain);
  try {
    return await execute(calls, {
      ...details,
      nonce,
      tip: 0,
      ...(resourceBounds ? { resourceBounds } : {}),
    });
  } catch (error) {
    dispenser.nextNonce = undefined;
    throw error;
  }
}

/**
 * A known nonce is taken synchronously, so concurrent callers receive
 * distinct, increasing nonces in call order. Waiters on a shared read re-enter
 * in registration order once it lands, which keeps that same ordering; if a
 * failed send marks the dispenser stale again in between, they read anew
 * instead of reusing anything.
 */
function takeNonce(account: GameplaySubmitAccount, dispenser: AccountNonceDispenser): Promise<bigint> {
  if (dispenser.nextNonce !== undefined) {
    const nonce = dispenser.nextNonce;
    dispenser.nextNonce = nonce + 1n;
    return Promise.resolve(nonce);
  }
  dispenser.nonceRead ??= readPreConfirmedNonce(account, dispenser);
  return dispenser.nonceRead.then(() => takeNonce(account, dispenser));
}

function readPreConfirmedNonce(account: GameplaySubmitAccount, dispenser: AccountNonceDispenser): Promise<void> {
  return account
    .getNonce(BlockTag.PRE_CONFIRMED)
    .then((nonce) => {
      dispenser.nextNonce = BigInt(nonce);
    })
    .finally(() => {
      dispenser.nonceRead = undefined;
    });
}

function isNonceRejection(error: unknown): boolean {
  const message = extractErrorMessage(error, "");
  return /nonce/i.test(message) && /(already|expected|got|invalid|mismatch|too high|too low)/i.test(message);
}
