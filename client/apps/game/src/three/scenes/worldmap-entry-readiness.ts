import type { WorldmapWarpTravelPhase } from "./worldmap-warp-travel-refresh";

interface CompleteWorldmapEntryReadinessInput {
  bootToken: number;
  commitCriticalPass: () => Promise<void>;
  isCurrentBootToken: (bootToken: number) => boolean;
  markCriticalPassReady: (bootToken: number) => void;
  markWorldmapConverged: (bootToken: number) => void;
  phase: WorldmapWarpTravelPhase;
  waitForAmbientConvergence: () => Promise<void>;
}

export async function completeWorldmapEntryReadiness(input: CompleteWorldmapEntryReadinessInput): Promise<void> {
  await input.commitCriticalPass();
  publishForCurrentBoot(input, input.markCriticalPassReady);

  if (input.phase === "initial") {
    await input.waitForAmbientConvergence();
  }

  publishForCurrentBoot(input, input.markWorldmapConverged);
}

function publishForCurrentBoot(
  input: Pick<CompleteWorldmapEntryReadinessInput, "bootToken" | "isCurrentBootToken">,
  publish: (bootToken: number) => void,
): void {
  if (input.isCurrentBootToken(input.bootToken)) {
    publish(input.bootToken);
  }
}
