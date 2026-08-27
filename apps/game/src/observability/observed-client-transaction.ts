import { type TransactionType } from "@bibliothecadao/provider";
import { getActiveGameSyncRuntime } from "@bibliothecadao/eternum/game-sync";
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

type WaitCapableProvider = {
  channel?: {
    nodeUrl?: string;
  };
  waitForTransaction?: (txHash: string) => Promise<unknown>;
  waitForTransactionWithCheck?: (txHash: string) => Promise<unknown>;
};

type ObservedTransactionAccount = Pick<Account, "address" | "execute" | "getNonce"> & {
  provider?: WaitCapableProvider;
  waitForTransaction?: (txHash: string) => Promise<unknown>;
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
  confirm?: ((txHash: string, account: ObservedTransactionAccount) => Promise<unknown>) | false;
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

const resolveConfirmationWait = (
  input: ExecuteObservedClientTransactionInput,
): ((txHash: string, account: ObservedTransactionAccount) => Promise<unknown>) | null => {
  if (input.confirm === false) {
    return null;
  }

  if (input.confirm) {
    return input.confirm;
  }

  const gameSync = getActiveGameSyncRuntime();
  if (gameSync?.hasTransactionStatusChannel()) {
    return async (txHash: string, _account: ObservedTransactionAccount) => gameSync.waitForTransaction(txHash);
  }

  if (input.account.provider && typeof input.account.provider.waitForTransactionWithCheck === "function") {
    return async (txHash: string, _account: ObservedTransactionAccount) => {
      await input.account.provider?.waitForTransactionWithCheck?.(txHash);
    };
  }

  if (typeof input.account.waitForTransaction === "function") {
    return async (txHash: string, account: ObservedTransactionAccount) => {
      await account.waitForTransaction?.(txHash);
    };
  }

  if (input.account.provider && typeof input.account.provider.waitForTransaction === "function") {
    return async (txHash: string, _account: ObservedTransactionAccount) => {
      await input.account.provider?.waitForTransaction?.(txHash);
    };
  }

  return null;
};

const observeBackgroundTransactionConfirmation = (
  input: ExecuteObservedClientTransactionInput,
  transactionHash: string,
  waitForConfirmation: (txHash: string, account: ObservedTransactionAccount) => Promise<unknown>,
) => {
  const transactionContext = buildTransactionContext(input, transactionHash);
  addClientTransactionBreadcrumb({
    stage: "pending",
    message: `${input.operation} confirmation pending`,
    context: transactionContext,
  });

  void waitForConfirmation(transactionHash, input.account)
    .then(() => {
      addClientTransactionBreadcrumb({
        stage: "completed",
        message: `${input.operation} confirmed`,
        context: transactionContext,
      });
    })
    .catch((error) => {
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
  const waitForConfirmation = resolveConfirmationWait(input);
  const shouldWaitForConfirmation = input.waitForConfirmation ?? true;

  let result: T;
  try {
    result = (await executeGameplayAccountTransaction({
      account: input.account,
      calls: input.calls,
      chain: input.chain,
    })) as T;
  } catch (error) {
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
      observeBackgroundTransactionConfirmation(input, transactionHash, waitForConfirmation);
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
    await waitForConfirmation(transactionHash, input.account);
    addClientTransactionBreadcrumb({
      stage: "completed",
      message: `${input.confirmationLabel ?? input.operation} confirmed`,
      context: transactionContext,
    });
    return result;
  } catch (error) {
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
