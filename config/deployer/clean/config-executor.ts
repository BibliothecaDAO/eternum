import type { Account } from "starknet";
import type {
  CleanConfigContext,
  ConfigLogger,
  ConfigExecutionResult,
  ConfigStep,
  ConfigStepHooks,
  ExecutedConfigStep,
  ExecutionMode,
} from "./types";

interface BatchCapableProvider {
  beginBatch: (options: { signer: Account; immediateEntrypoints?: string[] }) => Promise<void> | void;
  endBatch: (options?: { flush?: boolean }) => Promise<unknown>;
}

interface ExecuteConfigStepsInput<Provider> {
  context: CleanConfigContext<Provider>;
  steps: ConfigStep<Provider>[];
  mode?: ExecutionMode;
  hooks?: ConfigStepHooks<Provider>;
  suppressStepLogs?: boolean;
}

const SILENT_LOGGER: ConfigLogger = {
  log: () => undefined,
  info: () => undefined,
};

function isBatchCapableProvider(provider: unknown): provider is BatchCapableProvider {
  return (
    typeof provider === "object" &&
    provider !== null &&
    typeof (provider as BatchCapableProvider).beginBatch === "function" &&
    typeof (provider as BatchCapableProvider).endBatch === "function"
  );
}

export async function executeConfigSteps<Provider>({
  context,
  steps,
  mode = "batched",
  hooks,
  suppressStepLogs = false,
}: ExecuteConfigStepsInput<Provider>): Promise<ConfigExecutionResult> {
  const executedSteps: ExecutedConfigStep[] = [];
  let batchOpened = false;
  let batchProvider: BatchCapableProvider | null = null;

  if (mode === "batched") {
    if (!isBatchCapableProvider(context.provider)) {
      throw new Error("Selected batched execution mode, but provider does not support beginBatch/endBatch");
    }
    batchProvider = context.provider;
    await batchProvider.beginBatch({ signer: context.account });
    batchOpened = true;
  }

  try {
    for (const [index, step] of steps.entries()) {
      const stepStartedAt = Date.now();
      // Step hooks power the operator-facing progress output without coupling
      // the executor to any particular logging implementation.
      hooks?.onStepStart?.(step, index, steps.length);
      const stepContext = suppressStepLogs ? { ...context, logger: SILENT_LOGGER } : context;
      await step.execute(stepContext);
      executedSteps.push({ id: step.id, description: step.description });
      hooks?.onStepComplete?.(step, index, steps.length, Date.now() - stepStartedAt);
    }

    let transactionHash: string | undefined;
    if (batchOpened && batchProvider) {
      const receipt = await batchProvider.endBatch({ flush: true });
      batchOpened = false;
      transactionHash = (receipt as { transaction_hash?: string } | null)?.transaction_hash;
    }

    return {
      mode,
      steps: executedSteps,
      transactionHash,
    };
  } catch (error) {
    if (batchOpened && batchProvider) {
      try {
        await batchProvider.endBatch({ flush: false });
      } catch {
        // Best effort cleanup only.
      }
    }
    throw error;
  }
}
