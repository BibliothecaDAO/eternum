import mainnetAddresses from "../../../contracts/common/addresses/mainnet.json";
import slotAddresses from "../../../contracts/common/addresses/slot.json";
import slottestAddresses from "../../../contracts/common/addresses/slottest.json";
import { resolveConfiguredAddress } from "./address";

const CANONICAL_ADDRESSES = {
  mainnet: mainnetAddresses,
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
