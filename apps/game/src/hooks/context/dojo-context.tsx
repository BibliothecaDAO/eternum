import { ReactNode, useContext, useMemo } from "react";

import { displayAddress } from "@/ui/utils/utils";
import { SetupResult } from "@bibliothecadao/dojo";
import { DojoContext } from "@bibliothecadao/react";
import { Account, AccountInterface } from "starknet";

interface DojoProviderProps {
  children: ReactNode;
  value: SetupResult;
  account: Account | AccountInterface;
}

export const DojoProvider = ({ children, value, account }: DojoProviderProps) => {
  const currentValue = useContext(DojoContext);
  if (currentValue) {
    throw new Error("DojoProvider can only be used once");
  }

  const accountAddress = "address" in account ? account.address : "";

  // Memoize the context value to prevent unnecessary re-renders of all useDojo() consumers
  const contextValue = useMemo(
    () => ({
      ...value,
      account: {
        account,
        accountDisplay: displayAddress(accountAddress ?? ""),
      },
    }),
    [value, account, accountAddress],
  );

  return <DojoContext.Provider value={contextValue}>{children}</DojoContext.Provider>;
};
