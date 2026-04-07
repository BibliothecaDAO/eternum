interface RunWorldmapArmySelectionRecoveryInput {
  awaitActiveChunkSwitch?: () => Promise<void>;
  forceChunkRefresh: () => Promise<void>;
  isArmyAvailable: () => boolean;
  isArmyPendingMovement: () => boolean;
  maxRetries?: number;
  onError?: (error: unknown) => void;
  onRecovered?: () => void;
  onUnavailable?: () => void;
  retryDelayMs?: number;
  wait: (delayMs: number) => Promise<void>;
}

export async function runWorldmapArmySelectionRecovery(input: RunWorldmapArmySelectionRecoveryInput): Promise<void> {
  try {
    await input.awaitActiveChunkSwitch?.();
    await input.forceChunkRefresh();

    const maxRetries = input.maxRetries ?? 5;
    const retryDelayMs = input.retryDelayMs ?? 200;

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      if (input.isArmyPendingMovement()) {
        input.onUnavailable?.();
        return;
      }

      if (input.isArmyAvailable()) {
        input.onRecovered?.();
        return;
      }

      if (attempt < maxRetries) {
        await input.wait(retryDelayMs);
      }
    }

    input.onUnavailable?.();
  } catch (error) {
    input.onError?.(error);
  }
}
