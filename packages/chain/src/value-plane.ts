import mainnetAddresses from "../../../contracts/common/addresses/mainnet.json";
import sepoliaAddresses from "../../../contracts/common/addresses/sepolia.json";

/**
 * The value plane's addresses on each L2 an environment runs on: mainnet for production, Sepolia for dev. They come
 * from contracts/common/addresses/<network>.json, the files the deploy scripts write, which also name their L2 chain; a
 * key not deployed yet on that network (the ledger, the vault) resolves loudly instead of returning a zero an app could
 * silently read.
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

type AddressBook = Partial<Record<ValuePlaneContract, string>> & {
  l2Chain: string;
};

const addressBooks: Record<ValuePlaneNetwork, AddressBook> = {
  mainnet: mainnetAddresses,
  sepolia: sepoliaAddresses,
};

/** The deployed environments and the network each runs on: dev (staging) on Sepolia, production on mainnet. */
const ENVIRONMENT_NETWORKS = {
  staging: "sepolia",
  production: "mainnet",
} as const;

export type ValueEnvironment = keyof typeof ENVIRONMENT_NETWORKS;

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
  const value = deployedOrNull(contract, network);
  if (value === null)
    throw new ValuePlaneAddressMissingError(contract, network);
  return value;
};

/**
 * An environment's one L2, from its address book: the chain every client build and Worker of that environment uses,
 * and its GameLedger (null until the ledger is deployed there). The one source of both.
 */
export const environmentL2 = (environment: ValueEnvironment) => {
  const network = ENVIRONMENT_NETWORKS[environment];
  if (!network) throw new Error("ENVIRONMENT must be staging or production");
  const chain = addressBooks[network].l2Chain;
  if (chain !== "SN_MAIN" && chain !== "SN_SEPOLIA")
    throw new Error(
      `contracts/common/addresses/${network}.json names no L2 chain (l2Chain)`,
    );
  return { network, chain, ledger: deployedOrNull("ledger", network) } as const;
};

const deployedOrNull = (
  contract: ValuePlaneContract,
  network: ValuePlaneNetwork,
): string | null => {
  const value = addressBooks[network][contract];
  return value && BigInt(value) !== 0n ? value : null;
};
