interface StartWorldmapEntryReadinessInput {
  bootToken: number;
  commitCriticalPass: () => Promise<void>;
  isCurrent: () => boolean;
  markCriticalPassReady: (bootToken: number) => void;
  markWorldmapConverged: (bootToken: number) => void;
  requiresAmbientConvergence: boolean;
  reportAmbientConvergenceError: (error: unknown) => void;
  waitForAmbientConvergence: () => Promise<void>;
}

export async function startWorldmapEntryReadiness(input: StartWorldmapEntryReadinessInput): Promise<void> {
  await input.commitCriticalPass();
  if (!input.isCurrent()) {
    return;
  }

  input.markCriticalPassReady(input.bootToken);

  if (!input.requiresAmbientConvergence) {
    input.markWorldmapConverged(input.bootToken);
    return;
  }

  void completeAmbientConvergence(input);
}

async function completeAmbientConvergence(input: StartWorldmapEntryReadinessInput): Promise<void> {
  try {
    await input.waitForAmbientConvergence();
    if (input.isCurrent()) {
      input.markWorldmapConverged(input.bootToken);
    }
  } catch (error) {
    if (input.isCurrent()) {
      input.reportAmbientConvergenceError(error);
    }
  }
}
