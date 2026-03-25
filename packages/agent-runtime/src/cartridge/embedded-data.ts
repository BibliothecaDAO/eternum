import manifestLocal from "../../../../contracts/game/manifest_local.json";
import manifestMainnet from "../../../../contracts/game/manifest_mainnet.json";
import manifestSepolia from "../../../../contracts/game/manifest_sepolia.json";
import manifestSlot from "../../../../contracts/game/manifest_slot.json";
import manifestSlottest from "../../../../contracts/game/manifest_slottest.json";
import addressesLocal from "../../../../contracts/common/addresses/local.json";
import addressesMainnet from "../../../../contracts/common/addresses/mainnet.json";
import addressesSepolia from "../../../../contracts/common/addresses/sepolia.json";
import addressesSlot from "../../../../contracts/common/addresses/slot.json";
import addressesSlottest from "../../../../contracts/common/addresses/slottest.json";

import type { CartridgeWorldAuthContext } from "../types";

type AuthChain = CartridgeWorldAuthContext["chain"];

const MANIFESTS: Record<AuthChain, Record<string, unknown>> = {
  mainnet: manifestMainnet,
  sepolia: manifestSepolia,
  slot: manifestSlot,
  slottest: manifestSlottest,
  local: manifestLocal,
};

const ADDRESSES: Record<AuthChain, Record<string, unknown>> = {
  mainnet: addressesMainnet,
  sepolia: addressesSepolia,
  slot: addressesSlot,
  slottest: addressesSlottest,
  local: addressesLocal,
};

export function getEmbeddedManifest(chain: AuthChain): Record<string, unknown> {
  const manifest = MANIFESTS[chain];
  if (!manifest) {
    throw new Error(`No embedded manifest for chain "${chain}".`);
  }

  return JSON.parse(JSON.stringify(manifest)) as Record<string, unknown>;
}

export function getEmbeddedAddresses(chain: AuthChain): Record<string, unknown> {
  const addresses = ADDRESSES[chain];
  if (!addresses) {
    throw new Error(`No embedded addresses for chain "${chain}".`);
  }

  return JSON.parse(JSON.stringify(addresses)) as Record<string, unknown>;
}
