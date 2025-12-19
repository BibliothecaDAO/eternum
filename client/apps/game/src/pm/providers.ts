import { useMemo } from "react";

import type { RegisteredToken } from "./bindings";
import { getPredictionMarketConfig } from "./prediction-market-config";

const LORDS_TOKEN: RegisteredToken = {
  contract_address: getPredictionMarketConfig().collateralToken,
  name: "LORDS",
  symbol: "LORDS",
  decimals: 18,
};

export const useConfig = () => {
  const tokens = useMemo(() => [LORDS_TOKEN], []);

  return useMemo(
    () => ({
      registeredOracles: ["All"],
      registeredTokens: tokens,
      getRegisteredToken: (address: string | undefined) =>
        tokens.find((token) => BigInt(token.contract_address) === BigInt(address || 0)) ?? LORDS_TOKEN,
    }),
    [tokens],
  );
};
