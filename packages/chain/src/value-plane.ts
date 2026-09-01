import mainnetAddresses from "../../../contracts/common/addresses/mainnet.json";

/**
 * The value plane lives on Starknet mainnet from the start (owner decision, 2026-08-30).
 * Addresses come from contracts/common/addresses/mainnet.json, the file the deploy
 * scripts write; keys that have not been deployed yet (ledger, vault) resolve loudly
 * instead of returning a zero an app could silently read.
 */
export type ValuePlaneContract =
  | "ledger"
  | "vault"
  | "lords"
  | "mmrToken"
  | "seasonPass"
  | "villagePass"
  | "lootChests"
  | "cosmetics";

const addressBook = mainnetAddresses as Partial<
  Record<ValuePlaneContract, string>
>;

export class ValuePlaneAddressMissingError extends Error {
  constructor(public readonly contract: ValuePlaneContract) {
    super(
      `Mainnet address for "${contract}" is not deployed yet (contracts/common/addresses/mainnet.json)`,
    );
    this.name = "ValuePlaneAddressMissingError";
  }
}

export const valuePlaneAddress = (contract: ValuePlaneContract): string => {
  const value = addressBook[contract];
  if (!value || BigInt(value) === 0n) {
    throw new ValuePlaneAddressMissingError(contract);
  }
  return value;
};
