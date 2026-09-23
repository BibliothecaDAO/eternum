import { createContext, ReactNode, useContext, useMemo } from "react";

import { displayAddress } from "@/ui/utils/utils";
import type { GameClientSetup } from "@bibliothecadao/eternum/game-client";
import { Account, AccountInterface } from "starknet";

interface GameAccount {
  account: AccountInterface;
  accountDisplay: string;
}

interface GameContextType extends GameClientSetup {
  account: GameAccount;
}

const GameContext = createContext<GameContextType | null>(null);

/** The booted game's setup and the account playing it; only the game layout renders inside a GameProvider. */
export const useGame = () => {
  const value = useContext(GameContext);
  if (!value) throw new Error("useGame requires GameContext");
  return { setup: value, account: value.account, network: value.network };
};

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
