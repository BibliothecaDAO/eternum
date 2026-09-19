import { ReactNode, useContext, useMemo } from "react";

import { displayAddress } from "@/ui/utils/utils";
import type { GameClientSetup } from "@bibliothecadao/eternum/game-client";
import { GameContext } from "@bibliothecadao/react";
import { Account, AccountInterface } from "starknet";

interface GameProviderProps {
  children: ReactNode;
  value: GameClientSetup;
  account: Account | AccountInterface;
}

export const GameProvider = ({ children, value, account }: GameProviderProps) => {
  const currentValue = useContext(GameContext);
  if (currentValue) {
    throw new Error("GameProvider can only be used once");
  }

  const accountAddress = "address" in account ? account.address : "";

  // Memoize the context value to prevent unnecessary re-renders of all useGame() consumers
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

  return <GameContext.Provider value={contextValue}>{children}</GameContext.Provider>;
};
