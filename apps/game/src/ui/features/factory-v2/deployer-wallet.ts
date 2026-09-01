import { getSeasonAddresses } from "@contracts";
import type { GameChain as Chain } from "@realms-world/chain";
import type { FactoryLaunchChain } from "./types";

export interface FactoryDeployerTokenDefinition {
  symbol: "STRK" | "LORDS";
  address: string;
  decimals: number;
}

interface FactoryDeployerWalletDefinition {
  address: string;
  tokens: FactoryDeployerTokenDefinition[];
}

const TOKEN_DECIMALS = 18;
const BALANCE_FRACTION_DIGITS = 4;

export const resolveFactoryDeployerWallet = (chain: FactoryLaunchChain): FactoryDeployerWalletDefinition => {
  const seasonAddresses = getSeasonAddresses(chain as Chain);
  return {
    address: requireTokenAddress(seasonAddresses.factoryDeployer, chain, "factory deployer"),
    tokens: resolveFactoryDeployerTokens(chain, seasonAddresses),
  };
};

export const formatFactoryDeployerTokenBalance = (value: bigint, decimals: number = TOKEN_DECIMALS) => {
  const divisor = 10n ** BigInt(decimals);
  const whole = value / divisor;
  const fraction = value % divisor;
  const fractionText = fraction.toString().padStart(decimals, "0").slice(0, BALANCE_FRACTION_DIGITS);

  return `${whole.toLocaleString("en-US")}.${fractionText}`;
};

function resolveFactoryDeployerTokens(
  chain: FactoryLaunchChain,
  seasonAddresses: ReturnType<typeof getSeasonAddresses>,
): FactoryDeployerTokenDefinition[] {
  const tokens: FactoryDeployerTokenDefinition[] = [
    {
      symbol: "STRK",
      address: requireTokenAddress(seasonAddresses.strk, chain, "STRK"),
      decimals: TOKEN_DECIMALS,
    },
  ];
  if (isConfiguredTokenAddress(seasonAddresses.lords)) {
    tokens.push({ symbol: "LORDS", address: seasonAddresses.lords, decimals: TOKEN_DECIMALS });
  }
  return tokens;
}

function isConfiguredTokenAddress(address: string | undefined): address is string {
  return Boolean(address) && BigInt(address as string) !== 0n;
}

function requireTokenAddress(address: string | undefined, chain: FactoryLaunchChain, symbol: string): string {
  if (!address) throw new Error(`${symbol} address is not configured for ${chain}`);
  return address;
}
