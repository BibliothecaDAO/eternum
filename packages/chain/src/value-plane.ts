import devAddresses from "../../../contracts/common/addresses/dev.json";
import mainnetAddresses from "../../../contracts/common/addresses/mainnet.json";
import environments from "../../../deploy/first/environments.json";

export type ValuePlaneContract =
  | "ledger"
  | "vault"
  | "realms"
  | "lords"
  | "mmrToken"
  | "seasonPass"
  | "villagePass"
  | "lootChests"
  | "cosmetics";

export type ValueEnvironment = "staging" | "production";

type AddressBook = Partial<Record<ValuePlaneContract, string>> & {
  l2Chain: string;
};

const books: Record<string, AddressBook> = {
  "dev.json": devAddresses,
  "mainnet.json": mainnetAddresses,
};

/**
 * The deploy table names each environment's book, so a build reads the contracts its own deploy wrote. Dev and
 * production share mainnet, but never select contracts by network; two environments share contracts only when the
 * table names one book for both.
 */
const bookOf = (environment: "dev" | "production") => {
  const path = environments[environment].book;
  const addresses = books[path];
  if (!addresses)
    throw new Error(
      `deploy/first/environments.json names an unknown book ${path}`,
    );
  return { path, addresses };
};

const addressBooks: Record<
  ValueEnvironment,
  { path: string; addresses: AddressBook }
> = {
  staging: bookOf("dev"),
  production: bookOf("production"),
};

/**
 * Whether an environment owns the ledger its book names. While production reads dev's book the two share one ledger,
 * whose pause and Blitz season belong to production: dev pauses nothing and opens no paid Blitz slot, and its free test
 * Blitz games stay. Once production names a book of its own again, dev owns its ledger again.
 */
export const ownsValueLedger = (environment: ValueEnvironment) => {
  addressBook(environment);
  return (
    environment === "production" ||
    addressBooks.staging.path !== addressBooks.production.path
  );
};

export class ValuePlaneAddressMissingError extends Error {
  constructor(
    public readonly contract: ValuePlaneContract,
    public readonly environment: ValueEnvironment,
  ) {
    super(
      `The ${environment} address for "${contract}" is not deployed yet (contracts/common/addresses/${addressBook(environment).path})`,
    );
    this.name = "ValuePlaneAddressMissingError";
  }
}

export const valuePlaneAddress = (
  contract: ValuePlaneContract,
  environment: ValueEnvironment,
): string => {
  const value = deployedOrNull(contract, environment);
  if (value === null)
    throw new ValuePlaneAddressMissingError(contract, environment);
  return value;
};

/** One environment book supplies every build and Worker's L2 and ledger; absence never selects another book. */
export const environmentL2 = (environment: ValueEnvironment) => {
  const { addresses, path } = addressBook(environment);
  if (addresses.l2Chain !== "SN_MAIN")
    throw new Error(
      `contracts/common/addresses/${path} must name SN_MAIN (l2Chain)`,
    );
  return {
    network: "mainnet",
    chain: addresses.l2Chain,
    ledger: deployedOrNull("ledger", environment),
  } as const;
};

const addressBook = (environment: ValueEnvironment) => {
  if (environment !== "staging" && environment !== "production")
    throw new Error("ENVIRONMENT must be staging or production");
  return addressBooks[environment];
};

const deployedOrNull = (
  contract: ValuePlaneContract,
  environment: ValueEnvironment,
): string | null => {
  const value = addressBook(environment).addresses[contract];
  return value && BigInt(value) !== BigInt(0) ? value : null;
};
