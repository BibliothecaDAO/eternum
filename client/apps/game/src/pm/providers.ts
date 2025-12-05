import { useMemo } from "react";

export const useConfig = () => {
  return useMemo(
    () => ({
      registeredOracles: ["All"],
      registeredTokens: ["All"],
      getRegisteredToken: (_address: string | undefined) => undefined,
    }),
    [],
  );
};
