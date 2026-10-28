import devAddresses from "../../../contracts/common/addresses/dev.json";
import productionAddresses from "../../../contracts/common/addresses/production.json";
import { ChainId } from "./chains";
import { LORDS } from "./contracts";

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
  /** The block the ledger was deployed in, written with its address by setup. */
  ledgerDeploymentBlock?: number;
};

/** Dev and production share mainnet, but never select contracts by network. */
const addressBooks: Record<
  ValueEnvironment,
  { path: string; addresses: AddressBook }
> = {
  staging: { path: "dev.json", addresses: devAddresses },
  production: { path: "production.json", addresses: productionAddresses },
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

/**
 * The block the environment's ledger was deployed in. No ledger event is older, so every scan of its history starts
 * here; a book naming a ledger without it is refused.
 */
export const ledgerDeploymentBlock = (
  environment: ValueEnvironment,
): number => {
  valuePlaneAddress("ledger", environment);
  const { addresses, path } = addressBook(environment);
  const block = addresses.ledgerDeploymentBlock;
  if (typeof block !== "number" || !Number.isSafeInteger(block) || block <= 0)
    throw new Error(
      `contracts/common/addresses/${path} names a ledger without its deployment block (ledgerDeploymentBlock)`,
    );
  return block;
};

/**
 * Whether a ledger's token is a test token: anything but Starknet's LORDS. A test token has a public mint anyone may
 * call; LORDS has none, so nothing mints the LORDS a payer lacks.
 */
export const isTestLords = (token: string): boolean =>
  BigInt(token) !== BigInt(LORDS[ChainId.SN_MAIN]!.address);

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
