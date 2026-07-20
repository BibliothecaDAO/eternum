import localAddresses from "../../../contracts/common/addresses/local.json";
import mainnetAddresses from "../../../contracts/common/addresses/mainnet.json";
import sepoliaAddresses from "../../../contracts/common/addresses/sepolia.json";
import slotAddresses from "../../../contracts/common/addresses/slot.json";
import slottestAddresses from "../../../contracts/common/addresses/slottest.json";
import { resolveConfiguredAddress } from "./address";

const CANONICAL_ADDRESSES = {
  local: localAddresses,
  mainnet: mainnetAddresses,
  sepolia: sepoliaAddresses,
  slot: slotAddresses,
  slottest: slottestAddresses,
} as const;

export type CanonicalAddressChain = keyof typeof CANONICAL_ADDRESSES;

export function resolveCanonicalAddress(chain: CanonicalAddressChain, semanticKey: string): string {
  const addresses = CANONICAL_ADDRESSES[chain] as Record<string, unknown>;
  const value = addresses[semanticKey];

  if (typeof value !== "string") {
    throw new Error(`No canonical ${semanticKey} address configured for ${chain}`);
  }

  return resolveConfiguredAddress(value);
}
