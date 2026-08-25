export interface ShouldShowSetupTimeoutToastInput {
  nowMs: number;
  lastShownAtMs: number;
  throttleMs: number;
  reconnectAttempt: number;
  lastShownAtAttempt: number;
}

export function shouldShowSetupTimeoutToast(input: ShouldShowSetupTimeoutToastInput): boolean {
  if (input.reconnectAttempt !== input.lastShownAtAttempt) {
    return true;
  }
  return input.nowMs - input.lastShownAtMs >= input.throttleMs;
}
