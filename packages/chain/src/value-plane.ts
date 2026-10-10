import mainnetAddresses from "../../../contracts/common/addresses/mainnet.json";
import sepoliaAddresses from "../../../contracts/common/addresses/sepolia.json";

/**
 * The value plane's addresses on each L2 an environment runs on: mainnet for production, Sepolia for dev. They come
 * from contracts/common/addresses/<network>.json, the files the deploy scripts write; a key not deployed yet on that
 * network (the ledger, the vault) resolves loudly instead of returning a zero an app could silently read.
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

export type ValuePlaneNetwork = "mainnet" | "sepolia";

const addressBooks: Record<
  ValuePlaneNetwork,
  Partial<Record<ValuePlaneContract, string>>
> = {
  mainnet: mainnetAddresses,
  sepolia: sepoliaAddresses,
};

export class ValuePlaneAddressMissingError extends Error {
  constructor(
    public readonly contract: ValuePlaneContract,
    public readonly network: ValuePlaneNetwork,
  ) {
    super(
      `The ${network} address for "${contract}" is not deployed yet (contracts/common/addresses/${network}.json)`,
    );
    this.name = "ValuePlaneAddressMissingError";
  }
}

export const valuePlaneAddress = (
  contract: ValuePlaneContract,
  network: ValuePlaneNetwork,
): string => {
  const value = addressBooks[network][contract];
  if (!value || BigInt(value) === 0n) {
    throw new ValuePlaneAddressMissingError(contract, network);
  }
  return value;
};
