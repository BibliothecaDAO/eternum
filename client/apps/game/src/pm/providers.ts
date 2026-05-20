import { useMemo } from "react";

import type { RegisteredToken } from "./bindings";
import { useRuntimeChain } from "@/runtime/world";
import type { Chain } from "@contracts";
import { env } from "../../env";
import type { PredictionMarketChain } from "./manifest-loader";
import { getPredictionMarketChain, getPredictionMarketConfigForChain } from "./prediction-market-config";

const buildLordsToken = (chain: PredictionMarketChain): RegisteredToken => ({
  contract_address: getPredictionMarketConfigForChain(chain).collateralToken,
  name: "LORDS",
  symbol: "LORDS",
  decimals: 18,
});

const buildRegisteredLordsTokens = (): RegisteredToken[] => {
  const tokens = [buildLordsToken("slot"), buildLordsToken("mainnet")];
  return Array.from(new Map(tokens.map((token) => [token.contract_address.toLowerCase(), token])).values());
};

export const useConfig = () => {
  const runtimeChain = useRuntimeChain(env.VITE_PUBLIC_CHAIN as Chain);
  const fallbackToken = useMemo(() => buildLordsToken(getPredictionMarketChain(runtimeChain)), [runtimeChain]);
  const tokens = useMemo(() => buildRegisteredLordsTokens(), []);

  return useMemo(
    () => ({
      registeredOracles: ["All"],
      registeredTokens: tokens,
      getRegisteredToken: (address: string | undefined) =>
        tokens.find((token) => BigInt(token.contract_address) === BigInt(address || 0)) ?? fallbackToken,
    }),
    [fallbackToken, tokens],
  );
};
