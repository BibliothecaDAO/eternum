import { type TransactionType } from "@bibliothecadao/provider";
import { getActiveGameSyncRuntime, type GameSyncTransaction } from "@bibliothecadao/eternum/game-sync";
import type { GameChain } from "@realms-world/chain";
import { type Account, type AllowArray, type Call } from "starknet";
import { executeGameplayAccountTransaction } from "@/account/gameplay-account-submit";
import { extractTransactionHash } from "@/ui/utils/transactions";
import {
  addClientTransactionBreadcrumb,
  reportClientTransactionFailure,
  resolveClientTransactionFailureStageFromError,
  type ClientTransactionFailureContext,
  type ClientTransactionSurface,
} from "./transaction-failure-reporting";
import {
  beginClientActionLatency,
  recordClientActionFailed,
  recordClientActionPreConfirmed,
  recordClientActionSubmitted,
} from "./client-action-latency";

type WaitCapableProvider = {
  channel?: {
    nodeUrl?: string;
  };
};

type ObservedTransactionAccount = Pick<Account, "address" | "execute" | "getNonce"> & {
  provider?: WaitCapableProvider;
};

type ExecuteObservedClientTransactionInput = {
  account: ObservedTransactionAccount;
  calls: AllowArray<Call>;
  surface: ClientTransactionSurface;
  operation: string;
  transactionType?: TransactionType;
  waitForConfirmation?: boolean;
  confirmationLabel?: string;
  chain: GameChain;
  worldName?: string;
  worldAddress?: string;
  rpcHost?: string;
};

const toCallArray = (calls: AllowArray<Call>): Call[] => {
  return Array.isArray(calls) ? calls : [calls];
};

const buildTransactionContext = (
  input: ExecuteObservedClientTransactionInput,
  transactionHash?: string,
): ClientTransactionFailureContext => {
  const callArray = toCallArray(input.calls);
  const entrypoints = callArray
    .map((call) => call.entrypoint)
    .filter((entrypoint): entrypoint is string => Boolean(entrypoint));
  const contractAddresses = Array.from(
    new Set(callArray.map((call) => call.contractAddress).filter((address): address is string => Boolean(address))),
  );

  return {
    surface: input.surface,
    operation: input.operation,
    stage: "submit",
    transactionType: input.transactionType,
    transactionHash,
    walletAddress: input.account.address ?? null,
    chain: input.chain,
    worldName: input.worldName,
    worldAddress: input.worldAddress,
    rpcHost: input.rpcHost ?? input.account.provider?.channel?.nodeUrl,
    ...(entrypoints.length > 0 ? { entrypoints } : {}),
    ...(contractAddresses.length > 0 ? { contractAddresses } : {}),
  };
};

const resolveConfirmationWait = ():
  | ((txHash: string, account: ObservedTransactionAccount) => Promise<GameSyncTransaction>)
  | null => {
  const gameSync = getActiveGameSyncRuntime();
  if (gameSync?.hasTransactionStatusChannel()) {
    return async (txHash: string, _account: ObservedTransactionAccount) => gameSync.waitForTransaction(txHash);
  }

  return null;
};

const observeBackgroundTransactionConfirmation = (
  input: ExecuteObservedClientTransactionInput,
  actionId: string,
  transactionHash: string,
  waitForConfirmation: (txHash: string, account: ObservedTransactionAccount) => Promise<GameSyncTransaction>,
) => {
  const transactionContext = buildTransactionContext(input, transactionHash);
  addClientTransactionBreadcrumb({
    stage: "pending",
    message: `${input.operation} confirmation pending`,
    context: transactionContext,
  });

  void waitForConfirmation(transactionHash, input.account)
    .then((transaction) => {
      if (transaction.status === "PRE_CONFIRMED") recordClientActionPreConfirmed(transactionHash);
      addClientTransactionBreadcrumb({
        stage: "completed",
        message: `${input.operation} confirmed`,
        context: transactionContext,
      });
    })
    .catch((error) => {
      recordClientActionFailed(actionId, error);
      void reportClientTransactionFailure({
        error,
        context: {
          ...transactionContext,
          stage: resolveClientTransactionFailureStageFromError(error, "background_confirmation"),
        },
      });
    });
};

export const executeObservedClientTransaction = async <T = unknown>(
  input: ExecuteObservedClientTransactionInput,
): Promise<T> => {
  const actionId = beginClientActionLatency({ operation: input.operation, surface: input.surface });
  const waitForConfirmation = resolveConfirmationWait();
  const shouldWaitForConfirmation = input.waitForConfirmation ?? true;

  let result: T;
  try {
    result = (await executeGameplayAccountTransaction({
      account: input.account,
      calls: input.calls,
      chain: input.chain,
    })) as T;
  } catch (error) {
    recordClientActionFailed(actionId, error);
    const transactionContext = buildTransactionContext(input);
    await reportClientTransactionFailure({
      error,
      context: {
        ...transactionContext,
        stage: resolveClientTransactionFailureStageFromError(error, "submit"),
      },
    });
    throw error;
  }

  const transactionHash = extractTransactionHash(result);
  if (transactionHash) recordClientActionSubmitted(actionId, transactionHash);
  const transactionContext = buildTransactionContext(input, transactionHash ?? undefined);
  addClientTransactionBreadcrumb({
    stage: "submitted",
    message: `${input.operation} submitted`,
    context: transactionContext,
  });

  if (!transactionHash) {
    return result;
  }

  if (!shouldWaitForConfirmation) {
    if (waitForConfirmation) {
      observeBackgroundTransactionConfirmation(input, actionId, transactionHash, waitForConfirmation);
    } else {
      addClientTransactionBreadcrumb({
        stage: "confirmation_unverified",
        message: `${input.confirmationLabel ?? input.operation} confirmation unavailable`,
        context: {
          ...transactionContext,
          stage: "confirmation_unverified",
        },
      });
    }

    return result;
  }

  if (!waitForConfirmation) {
    addClientTransactionBreadcrumb({
      stage: "confirmation_unverified",
      message: `${input.confirmationLabel ?? input.operation} confirmation unavailable`,
      context: {
        ...transactionContext,
        stage: "confirmation_unverified",
      },
    });
    return result;
  }

  try {
    const transaction = await waitForConfirmation(transactionHash, input.account);
    if (transaction.status === "PRE_CONFIRMED") recordClientActionPreConfirmed(transactionHash);
    addClientTransactionBreadcrumb({
      stage: "completed",
      message: `${input.confirmationLabel ?? input.operation} confirmed`,
      context: transactionContext,
    });
    return result;
  } catch (error) {
    recordClientActionFailed(actionId, error);
    await reportClientTransactionFailure({
      error,
      context: {
        ...transactionContext,
        stage: resolveClientTransactionFailureStageFromError(error, "confirmation"),
      },
    });
    throw error;
  }
};
