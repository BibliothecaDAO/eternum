import type { ConfigurationNetwork } from "../../shared/game-environments";
import type { ConfigPatch } from "../common/merge-config";
import { type EnvironmentContext, resolveConfiguredAddress } from "../common/environment";
import { mergeConfigPatches } from "../common/merge-config";
import { VICTORY_POINTS_MULTIPLIER } from "./points";

function resolveEternumContractAddressConfig(context: EnvironmentContext): ConfigPatch {
  return {
    village: {
      village_pass_nft_address: resolveConfiguredAddress(context.addresses.villagePass, "villagePass"),
    },
  };
}

export function resolveEternumChainConfig(chain: ConfigurationNetwork, context: EnvironmentContext): ConfigPatch {
  if (chain === "madara") {
    return mergeConfigPatches(
      {
        season: { startSettlingAfterSeconds: 20, startMainAfterSeconds: 60, durationSeconds: 60 * 60 * 24 * 30 },
        // The sandbox season closes on victory points; the base sheet leaves the target unset.
        victoryPoints: { pointsForWin: 10_000_000n * BigInt(VICTORY_POINTS_MULTIPLIER) },
        dev: { mode: { on: false } },
      },
      resolveEternumContractAddressConfig(context),
    );
  }
  throw new Error(`Unsupported configuration profile ${chain}`);
}
