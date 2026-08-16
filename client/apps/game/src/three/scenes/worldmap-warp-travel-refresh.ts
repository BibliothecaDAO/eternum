export type WorldmapWarpTravelPhase = "initial" | "resume";

interface CompleteWorldmapInteractiveRefreshInput {
  phase: WorldmapWarpTravelPhase;
  refresh: () => Promise<boolean>;
}

export async function completeWorldmapInteractiveRefresh({
  phase,
  refresh,
}: CompleteWorldmapInteractiveRefreshInput): Promise<void> {
  const attemptCount = 2;

  for (let attempt = 0; attempt < attemptCount; attempt++) {
    if (await refresh()) {
      return;
    }
  }

  throw new Error(`World map did not finish its ${phase} interactive refresh.`);
}
