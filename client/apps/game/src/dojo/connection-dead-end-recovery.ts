export interface RunDeadEndRecoveryInput<TContext, TBootstrapResult> {
  resolveContext: () => TContext | null | undefined;
  resetBootstrap: () => void;
  bootstrapForContext: (context: TContext) => Promise<TBootstrapResult>;
  recordStreamReconnect: () => unknown;
  onSuccess?: (result: TBootstrapResult) => unknown | Promise<unknown>;
  onFailure?: (error: unknown) => void;
}

export async function runDeadEndRecovery<TContext, TBootstrapResult>(
  input: RunDeadEndRecoveryInput<TContext, TBootstrapResult>,
): Promise<void> {
  const context = input.resolveContext();
  if (!context) {
    return;
  }

  try {
    input.resetBootstrap();
    const result = await input.bootstrapForContext(context);
    await input.onSuccess?.(result);
  } catch (error) {
    input.onFailure?.(error);
  } finally {
    // Mirror the normal reconnect path (connection-health-monitor.ts) which
    // bumps streamReconnectVersion on both success and failure so subscribers
    // gated on it can re-mount and retry their own subscriptions.
    input.recordStreamReconnect();
  }
}
