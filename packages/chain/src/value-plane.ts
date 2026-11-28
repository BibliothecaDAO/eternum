import devAddresses from "../../../contracts/common/addresses/dev.json";
import productionAddresses from "../../../contracts/common/addresses/production.json";
import { ChainId } from "./chains";
import { LORDS } from "./contracts";

export type ValuePlaneContract =
  | "ledger"
  | "raceRewards"
  | "vault"
  | "realms"
  | "lords"
  | "mmrToken"
  | "seasonPass"
  | "villagePass"
  | "lootChests"
  | "cosmetics"
  | "treasury"
  | "veLords";

export const EVM_PAYMENT_CHAIN_ID = 1 as const;
export const SOLANA_PAYMENT_CLUSTER = "mainnet-beta" as const;

export interface EvmPaymentRail {
  readonly chainId: typeof EVM_PAYMENT_CHAIN_ID;
  readonly usdc: string;
  readonly treasury: string;
}

export interface SolanaPaymentRail {
  readonly cluster: typeof SOLANA_PAYMENT_CLUSTER;
  readonly usdc: string;
  readonly treasury: string;
}

export type ValueEnvironment = "staging" | "production";

type AddressBook = Partial<Record<ValuePlaneContract, string>> & {
  l2Chain: string;
  /** The block the ledger was deployed in, written with its address by setup. */
  ledgerDeploymentBlock?: number;
  evm?: { chainId?: number; usdc?: string; treasury?: string };
  solana?: { cluster?: string; usdc?: string; treasury?: string };
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

export const raceRewardsBeside = (ledger: string): string => {
  const book = Object.values(addressBooks).find(
    ({ addresses }) =>
      addresses.ledger && BigInt(addresses.ledger) === BigInt(ledger),
  );
  const rewards = book?.addresses.raceRewards;
  if (!rewards || BigInt(rewards) === BigInt(0))
    throw new Error(
      `No race rewards address is written beside the ledger ${ledger} in contracts/common/addresses`,
    );
  return rewards;
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
  const ledger = deployedOrNull("ledger", environment);
  return {
    network: "mainnet",
    chain: addresses.l2Chain,
    ledger,
    raceRewards: deployedOrNull("raceRewards", environment),
    ledgerDeploymentBlock:
      ledger === null ? null : ledgerDeploymentBlock(environment),
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

const EVM_ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;
const SOLANA_ADDRESS_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function assertAllowedEvmPaymentChain(
  chainId: number,
): asserts chainId is typeof EVM_PAYMENT_CHAIN_ID {
  if (chainId !== EVM_PAYMENT_CHAIN_ID) {
    throw new Error(
      `Unsupported EVM payment chainId ${chainId}: only Ethereum mainnet (${EVM_PAYMENT_CHAIN_ID}) is allowed`,
    );
  }
}

export const evmPaymentRail = (
  environment: ValueEnvironment,
): EvmPaymentRail => {
  const { addresses, path } = addressBook(environment);
  const rail = addresses.evm;
  if (!rail || typeof rail.chainId !== "number") {
    throw new Error(
      `contracts/common/addresses/${path} is missing evm payment configuration`,
    );
  }
  assertAllowedEvmPaymentChain(rail.chainId);
  if (
    !rail.usdc ||
    !EVM_ADDRESS_PATTERN.test(rail.usdc) ||
    BigInt(rail.usdc) === 0n
  ) {
    throw new Error(
      `contracts/common/addresses/${path} has an invalid evm.usdc address`,
    );
  }
  if (
    !rail.treasury ||
    !EVM_ADDRESS_PATTERN.test(rail.treasury) ||
    BigInt(rail.treasury) === 0n
  ) {
    throw new Error(
      `contracts/common/addresses/${path} has an invalid evm.treasury address`,
    );
  }
  return {
    chainId: EVM_PAYMENT_CHAIN_ID,
    usdc: rail.usdc,
    treasury: rail.treasury,
  };
};

export const solanaPaymentRail = (
  environment: ValueEnvironment,
): SolanaPaymentRail => {
  const { addresses, path } = addressBook(environment);
  const rail = addresses.solana;
  if (!rail || rail.cluster !== SOLANA_PAYMENT_CLUSTER) {
    throw new Error(
      `contracts/common/addresses/${path} must configure solana cluster ${SOLANA_PAYMENT_CLUSTER}`,
    );
  }
  if (!rail.usdc || !SOLANA_ADDRESS_PATTERN.test(rail.usdc)) {
    throw new Error(
      `contracts/common/addresses/${path} has an invalid solana.usdc address`,
    );
  }
  if (!rail.treasury || !SOLANA_ADDRESS_PATTERN.test(rail.treasury)) {
    throw new Error(
      `contracts/common/addresses/${path} has an invalid solana.treasury address`,
    );
  }
  return {
    cluster: SOLANA_PAYMENT_CLUSTER,
    usdc: rail.usdc,
    treasury: rail.treasury,
  };
};
