import type { Account } from "starknet";
import type {
  CleanConfigContext,
  ConfigLogger,
  ConfigExecutionResult,
  ConfigStep,
  ConfigStepHooks,
  ExecutedConfigStep,
  ExecutionMode,
} from "../types";

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

interface BatchExecutionState {
  opened: boolean;
  provider: BatchCapableProvider | null;
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

async function beginBatchExecutionIfNeeded<Provider>(
  mode: ExecutionMode,
  context: CleanConfigContext<Provider>,
): Promise<BatchExecutionState> {
  if (mode !== "batched") {
    return { opened: false, provider: null };
  }

  if (!isBatchCapableProvider(context.provider)) {
    throw new Error("Selected batched execution mode, but provider does not support beginBatch/endBatch");
  }

  await context.provider.beginBatch({ signer: context.account });
  return { opened: true, provider: context.provider };
}

function buildStepContext<Provider>(
  context: CleanConfigContext<Provider>,
  suppressStepLogs: boolean,
): CleanConfigContext<Provider> {
  return suppressStepLogs ? { ...context, logger: SILENT_LOGGER } : context;
}

async function executeStep<Provider>(params: {
  step: ConfigStep<Provider>;
  context: CleanConfigContext<Provider>;
  suppressStepLogs: boolean;
  hooks?: ConfigStepHooks<Provider>;
  index: number;
  total: number;
  executedSteps: ExecutedConfigStep[];
}): Promise<void> {
  const startedAt = Date.now();
  params.hooks?.onStepStart?.(params.step, params.index, params.total);
  await params.step.execute(buildStepContext(params.context, params.suppressStepLogs));
  params.executedSteps.push({ id: params.step.id, description: params.step.description });
  params.hooks?.onStepComplete?.(params.step, params.index, params.total, Date.now() - startedAt);
}

async function executeAllSteps<Provider>(params: {
  steps: ConfigStep<Provider>[];
  context: CleanConfigContext<Provider>;
  suppressStepLogs: boolean;
  hooks?: ConfigStepHooks<Provider>;
  executedSteps: ExecutedConfigStep[];
}): Promise<void> {
  for (const [index, step] of params.steps.entries()) {
    await executeStep({
      step,
      context: params.context,
      suppressStepLogs: params.suppressStepLogs,
      hooks: params.hooks,
      index,
      total: params.steps.length,
      executedSteps: params.executedSteps,
    });
  }
}

async function flushBatchExecution(state: BatchExecutionState): Promise<string | undefined> {
  if (!state.opened || !state.provider) {
    return undefined;
  }

  const receipt = await state.provider.endBatch({ flush: true });
  state.opened = false;
  return (receipt as { transaction_hash?: string } | null)?.transaction_hash;
}

async function cancelBatchExecution(state: BatchExecutionState): Promise<void> {
  if (!state.opened || !state.provider) {
    return;
  }

  try {
    await state.provider.endBatch({ flush: false });
  } catch {
    // Best effort cleanup only.
  }
}

export async function executeConfigSteps<Provider>({
  context,
  steps,
  mode = "batched",
  hooks,
  suppressStepLogs = false,
}: ExecuteConfigStepsInput<Provider>): Promise<ConfigExecutionResult> {
  const executedSteps: ExecutedConfigStep[] = [];
  const batchState = await beginBatchExecutionIfNeeded(mode, context);

  try {
    await executeAllSteps({
      steps,
      context,
      suppressStepLogs,
      hooks,
      executedSteps,
    });

    return {
      mode,
      steps: executedSteps,
      transactionHash: await flushBatchExecution(batchState),
    };
  } catch (error) {
    await cancelBatchExecution(batchState);
    throw error;
  }
}
