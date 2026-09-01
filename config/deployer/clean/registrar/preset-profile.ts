import type { BlitzBalanceProfileId } from "../../../source/blitz";
import type { DeploymentEnvironmentId } from "../types";

export const BALANCE_PROFILE_IDS: BlitzBalanceProfileId[] = ["official-60", "official-90"];

export function validatePresetBalanceProfile(
  environmentId: DeploymentEnvironmentId,
  balanceProfile?: BlitzBalanceProfileId,
): void {
  if (balanceProfile === undefined) return;
  if (!BALANCE_PROFILE_IDS.includes(balanceProfile)) {
    throw new Error(`--balance-profile must be one of: ${BALANCE_PROFILE_IDS.join(", ")}`);
  }
  if (!environmentId.endsWith(".blitz")) {
    throw new Error("--balance-profile only applies to Blitz environments");
  }
}
