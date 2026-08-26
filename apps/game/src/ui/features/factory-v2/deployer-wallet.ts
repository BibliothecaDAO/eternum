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

const FACTORY_DEPLOYER_ADDRESSES: Record<FactoryLaunchChain, string> = {
  madara: "0x055be462e718c4166d656d11f89e341115b8bc82389c3762a10eade04fcb225d",
  appchain: "0x127fd5f1fe78a71f8bcd1fec63e3fe2f0486b6ecd5c86a0466c3a21fa5cfcec",
};

const TOKEN_DECIMALS = 18;
const BALANCE_FRACTION_DIGITS = 4;

export const resolveFactoryDeployerWallet = (chain: FactoryLaunchChain): FactoryDeployerWalletDefinition => ({
  address: FACTORY_DEPLOYER_ADDRESSES[chain],
  tokens: resolveFactoryDeployerTokens(chain),
});

export const formatFactoryDeployerTokenBalance = (value: bigint, decimals: number = TOKEN_DECIMALS) => {
  const divisor = 10n ** BigInt(decimals);
  const whole = value / divisor;
  const fraction = value % divisor;
  const fractionText = fraction.toString().padStart(decimals, "0").slice(0, BALANCE_FRACTION_DIGITS);

  return `${whole.toLocaleString("en-US")}.${fractionText}`;
};

function resolveFactoryDeployerTokens(chain: FactoryLaunchChain): FactoryDeployerTokenDefinition[] {
  const seasonAddresses = getSeasonAddresses(chain as Chain);
  const tokens: FactoryDeployerTokenDefinition[] = [
    {
      symbol: "STRK",
      address: requireTokenAddress(seasonAddresses.strk, chain, "STRK"),
      decimals: TOKEN_DECIMALS,
    },
  ];
  if (chain === "appchain") {
    tokens.push({
      symbol: "LORDS",
      address: requireTokenAddress(seasonAddresses.lords, chain, "LORDS"),
      decimals: TOKEN_DECIMALS,
    });
  }
  return tokens;
}

function requireTokenAddress(address: string | undefined, chain: FactoryLaunchChain, symbol: string): string {
  if (!address) throw new Error(`${symbol} address is not configured for ${chain}`);
  return address;
}
