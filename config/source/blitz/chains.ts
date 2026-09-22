import type { GameChain } from "@realms-world/chain";
import { type EnvironmentContext, resolveConfiguredAddress } from "../common/environment";
import type { ConfigPatch } from "../common/merge-config";
import { mergeConfigPatches } from "../common/merge-config";
import { madaraBlitzConfig } from "./madara";

const STANDARD_BLITZ_CHAIN_CONFIG: ConfigPatch = {
  season: {
    startSettlingAfterSeconds: 59,
    startMainAfterSeconds: 60,
  },
  battle: {
    regularImmunityTicks: 0,
    villageImmunityTicks: 0,
    delaySeconds: 0,
  },
};

function resolveBlitzContractAddressConfig(context: EnvironmentContext): ConfigPatch {
  const addresses = context.addresses;

  return {
    blitz: {
      registration: {
        collectible_cosmetics_address: resolveConfiguredAddress(
          addresses["Collectibles: Realms: Cosmetic Items"],
          "Collectibles: Realms: Cosmetic Items",
        ),
        collectible_timelock_address: resolveConfiguredAddress(
          addresses["Collectibles: Timelock Maker"],
          "Collectibles: Timelock Maker",
        ),
        collectibles_lootchest_address: resolveConfiguredAddress(
          addresses["Collectibles: Realms: Loot Chest"],
          "Collectibles: Realms: Loot Chest",
        ),
        collectibles_elitenft_address: resolveConfiguredAddress(
          addresses["Collectibles: Realms: Elite Invite"],
          "Collectibles: Realms: Elite Invite",
        ),
      },
    },
  };
}

function resolveAppchainBlitzRegistrationConfig(context: EnvironmentContext): ConfigPatch {
  // Settling and registration open at game creation (owner ruling, Aug 2026);
  // the delay only covers config steps still being applied.
  // Override with APPCHAIN_REGISTRATION_DELAY_SECONDS.
  const delaySeconds = Number(process.env.APPCHAIN_REGISTRATION_DELAY_SECONDS) || 20;

  const durationSeconds = process.env.APPCHAIN_GAME_DURATION_SECONDS;

  return {
    // Real games, not a sandbox: dev mode bypasses the registration window and
    // makes has_ended() permanently false, so the game could never finish.
    dev: {
      mode: {
        on: false,
      },
    },
    ...(durationSeconds === undefined ? {} : { season: { durationSeconds: Number(durationSeconds) } }),
    blitz: {
      registration: {
        registration_delay_seconds: delaySeconds,
      },
    },
  };
}

export function resolveBlitzChainConfig(chain: GameChain, context: EnvironmentContext): ConfigPatch {
  switch (chain) {
    case "madara":
      // The standard patch applies on every chain — skipping it here shipped the
      // base sheet's season/battle values into registered preset 6 (24-tick spawn
      // immunity in a mode that has none).
      return mergeConfigPatches(STANDARD_BLITZ_CHAIN_CONFIG, madaraBlitzConfig);
    case "appchain":
      return mergeConfigPatches(
        STANDARD_BLITZ_CHAIN_CONFIG,
        resolveBlitzContractAddressConfig(context),
        resolveAppchainBlitzRegistrationConfig(context),
      );
  }
}
