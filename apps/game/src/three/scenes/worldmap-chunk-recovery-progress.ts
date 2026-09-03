const MAX_RECOVERY_SIGNATURES_WITHOUT_PROGRESS = 32;

export interface WorldmapChunkRecoveryProgress {
  markProgress(): void;
  claimRecovery(signature: string): boolean;
}

/** Allows one recovery for a failure shape, then requires observable chunk progress before repeating it. */
export function createWorldmapChunkRecoveryProgress(): WorldmapChunkRecoveryProgress {
  const attemptedSignatures = new Set<string>();

  return {
    markProgress() {
      attemptedSignatures.clear();
    },
    claimRecovery(signature) {
      if (attemptedSignatures.has(signature)) return false;
      if (attemptedSignatures.size >= MAX_RECOVERY_SIGNATURES_WITHOUT_PROGRESS) {
        const oldest = attemptedSignatures.values().next().value;
        if (oldest !== undefined) attemptedSignatures.delete(oldest);
      }
      attemptedSignatures.add(signature);
      return true;
    },
  };
}
