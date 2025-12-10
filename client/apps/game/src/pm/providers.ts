import { useMemo } from "react";

import type { RegisteredToken } from "./bindings";

const FALLBACK_TOKEN: RegisteredToken = {
  contract_address: "0x0",
  name: "Unknown collateral",
  symbol: "TKN",
  decimals: 18,
};

export const useConfig = () => {
  const tokens = useMemo(() => [FALLBACK_TOKEN], []);

  return useMemo(
    () => ({
      registeredOracles: ["All"],
      registeredTokens: tokens,
      getRegisteredToken: (address: string | undefined) =>
        tokens.find((token) => token.contract_address === address) ?? FALLBACK_TOKEN,
    }),
    [tokens],
  );
};
