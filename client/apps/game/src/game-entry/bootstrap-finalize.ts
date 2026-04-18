type GameEntryMilestone =
  | "entry-ready"
  | "session-policies-refresh-started"
  | "session-policies-refresh-completed"
  | "session-policies-refresh-skipped";

export interface FinalizeBootstrapSessionInput {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  connector: any | null;
  commitReady: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  refreshPolicies: (connector: any) => Promise<boolean>;
  markMilestone: (milestone: GameEntryMilestone) => void;
  logError: (error: unknown) => void;
  isStillActive: () => boolean;
}

export async function finalizeBootstrapSession({
  connector,
  commitReady,
  refreshPolicies,
  markMilestone,
  logError,
  isStillActive,
}: FinalizeBootstrapSessionInput): Promise<void> {
  if (!isStillActive()) {
    return;
  }

  commitReady();
  markMilestone("entry-ready");

  if (!connector) {
    markMilestone("session-policies-refresh-skipped");
    return;
  }

  markMilestone("session-policies-refresh-started");
  try {
    await refreshPolicies(connector);
    if (!isStillActive()) {
      return;
    }
    markMilestone("session-policies-refresh-completed");
  } catch (error) {
    logError(error);
  }
}
