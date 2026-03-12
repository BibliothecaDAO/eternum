/**
 * Embedded manifest and address data for standalone binary builds.
 *
 * JSON files are imported directly so Bun's bundler includes them in the
 * compiled binary. At runtime, {@link getManifest} and {@link getAddresses}
 * return the pre-loaded objects — no filesystem access required.
 */

import type { Chain } from "./policies.js";

// ── Manifests ────────────────────────────────────────────────────────────────

import manifestMainnet from "../../../../../contracts/game/manifest_mainnet.json";
import manifestSepolia from "../../../../../contracts/game/manifest_sepolia.json";
import manifestSlot from "../../../../../contracts/game/manifest_slot.json";
import manifestSlottest from "../../../../../contracts/game/manifest_slottest.json";
import manifestLocal from "../../../../../contracts/game/manifest_local.json";

const MANIFESTS: Record<Chain, any> = {
  mainnet: manifestMainnet,
  sepolia: manifestSepolia,
  slot: manifestSlot,
  slottest: manifestSlottest,
  local: manifestLocal,
};

// ── Addresses ────────────────────────────────────────────────────────────────

import addressesMainnet from "../../../../../contracts/common/addresses/mainnet.json";
import addressesSepolia from "../../../../../contracts/common/addresses/sepolia.json";
import addressesSlot from "../../../../../contracts/common/addresses/slot.json";
import addressesSlottest from "../../../../../contracts/common/addresses/slottest.json";
import addressesLocal from "../../../../../contracts/common/addresses/local.json";

const ADDRESSES: Record<Chain, any> = {
  mainnet: addressesMainnet,
  sepolia: addressesSepolia,
  slot: addressesSlot,
  slottest: addressesSlottest,
  local: addressesLocal,
};

// ── Public API ───────────────────────────────────────────────────────────────

/** Return the embedded manifest for a chain (deep clone to prevent mutation). */
export function getManifest(chain: Chain): any {
  const m = MANIFESTS[chain];
  if (!m) throw new Error(`No embedded manifest for chain "${chain}"`);
  return JSON.parse(JSON.stringify(m));
}

/** Return the embedded addresses for a chain. */
export function getAddresses(chain: Chain): any {
  const a = ADDRESSES[chain];
  if (!a) throw new Error(`No embedded addresses for chain "${chain}"`);
  return a;
}
