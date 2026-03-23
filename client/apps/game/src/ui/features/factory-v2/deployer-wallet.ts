import { getSeasonAddresses, type Chain } from "@contracts";
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
  mainnet: "0x023003676EF4A5E8f32f5c8714f83fc6bfbefD44C0461a8b7Be16d05b8Ea1532",
  slot: "0x127fd5f1fe78a71f8bcd1fec63e3fe2f0486b6ecd5c86a0466c3a21fa5cfcec",
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

  return [
    {
      symbol: "STRK",
      address: seasonAddresses.strk,
      decimals: TOKEN_DECIMALS,
    },
    {
      symbol: "LORDS",
      address: seasonAddresses.lords,
      decimals: TOKEN_DECIMALS,
    },
  ];
}
