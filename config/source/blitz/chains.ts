import type { GameChain } from "@realms-world/chain";
import { type EnvironmentContext, resolveConfiguredAddress } from "../common/environment";
import type { ConfigPatch } from "../common/merge-config";
import { mergeConfigPatches } from "../common/merge-config";
import { madaraBlitzConfig } from "./madara";

const STANDARD_BLITZ_CHAIN_CONFIG: ConfigPatch = {
  season: {
    startSettlingAfterSeconds: 59,
    startMainAfterSeconds: 60,
    durationSeconds: 60 * 60 * 2,
    pointRegistrationCloseAfterEndSeconds: 60 * 10,
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

  // A 30-day default game can never be observed ending on a dev chain.
  // 1h default matches the on-chain default preset 2 (official-60 / "Regular Fast").
  const durationSeconds = Number(process.env.APPCHAIN_GAME_DURATION_SECONDS) || 60 * 60;

  return {
    // Real games, not a sandbox: dev mode bypasses the registration window and
    // makes has_ended() permanently false, so the game could never finish.
    dev: {
      mode: {
        on: false,
      },
    },
    season: {
      durationSeconds,
    },
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
      // dev appchain (WP_REALMS_DEV): REAL mainnet game balance, free entry.
      // (The local-style dev balance shipped to testers as presets 2/3 —
      // presets are immutable, so the corrected rulebooks register as new
      // preset ids and the catalog points at them.)
      return mergeConfigPatches(
        STANDARD_BLITZ_CHAIN_CONFIG,
        resolveBlitzContractAddressConfig(context),
        resolveAppchainBlitzRegistrationConfig(context),
      );
  }
}
