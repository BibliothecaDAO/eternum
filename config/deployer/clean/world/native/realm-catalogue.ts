import { hash } from "starknet";
import traits from "./realm-traits.json";

export const canonicalRealmTraits: readonly number[] = Object.freeze(traits);

const prefixDigests = ["0x0"];

export function realmCatalogueDigest(count: number): string {
  if (!Number.isInteger(count) || count < 0 || count > canonicalRealmTraits.length)
    throw new Error(`Invalid realm catalogue length: ${count}`);
  for (let index = prefixDigests.length - 1; index < count; index++)
    prefixDigests.push(
      hash.computePoseidonHashOnElements([prefixDigests[index]!, index + 1, canonicalRealmTraits[index]!]),
    );
  return prefixDigests[count]!;
}
