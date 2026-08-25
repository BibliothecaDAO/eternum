import { shouldHoldShortcutArmySelectionProtection } from "./worldmap-chunk-transition";

interface SettleWorldmapShortcutSelectionProtectionInput {
  awaitActiveChunkSwitch?: () => Promise<void>;
  awaitRequestedRefresh?: (requestToken: number) => Promise<void>;
  currentRefreshToken: number;
  hasGlobalChunkSwitchPromise: boolean;
  hasPendingChunkRefreshTimer: boolean;
  isChunkRefreshRunning: boolean;
  warn: (message: string, error: unknown) => void;
}

interface ShouldResetWorldmapShortcutRefreshUiReasonInput {
  hasGlobalChunkSwitchPromise: boolean;
  hasPendingChunkRefreshTimer: boolean;
  isChunkRefreshRunning: boolean;
}

export async function settleWorldmapShortcutSelectionProtection(
  input: SettleWorldmapShortcutSelectionProtectionInput,
): Promise<void> {
  const shouldHoldProtection = shouldHoldShortcutArmySelectionProtection({
    hasPendingChunkRefreshTimer: input.hasPendingChunkRefreshTimer,
    isChunkRefreshRunning: input.isChunkRefreshRunning,
    hasGlobalChunkSwitchPromise: input.hasGlobalChunkSwitchPromise,
  });

  if (!shouldHoldProtection) {
    return;
  }

  if (input.awaitActiveChunkSwitch) {
    try {
      await input.awaitActiveChunkSwitch();
    } catch (error) {
      input.warn("[WorldMap] Shortcut selection wait failed for chunk switch settlement", error);
    }
  }

  if (input.currentRefreshToken > 0 && (input.hasPendingChunkRefreshTimer || input.isChunkRefreshRunning)) {
    try {
      await input.awaitRequestedRefresh?.(input.currentRefreshToken);
    } catch (error) {
      input.warn("[WorldMap] Shortcut selection wait failed for refresh settlement", error);
    }
  }
}

export function shouldResetWorldmapShortcutRefreshUiReason(
  input: ShouldResetWorldmapShortcutRefreshUiReasonInput,
): boolean {
  return !input.hasPendingChunkRefreshTimer && !input.isChunkRefreshRunning && !input.hasGlobalChunkSwitchPromise;
}
