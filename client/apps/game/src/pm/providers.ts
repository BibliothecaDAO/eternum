import { useMemo } from "react";

import type { RegisteredToken } from "./bindings";

const FALLBACK_TOKEN: RegisteredToken = {
  contract_address: "0x062cbbb9e30d90264ac63586d4f000be3cf5c178f11ae48f11f8b659eb060ac5",
  name: "LORDS",
  symbol: "LORDS",
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
