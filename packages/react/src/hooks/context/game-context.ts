import type { GameClientSetup } from "@bibliothecadao/eternum/game-client";
import { createContext, useContext } from "react";
import type { AccountInterface } from "starknet";

interface GameAccount {
  account: AccountInterface;
  accountDisplay: string;
}
interface GameContextType extends GameClientSetup {
  account: GameAccount;
}
export const GameContext = createContext<GameContextType | null>(null);

export const useGame = () => {
  const value = useContext(GameContext);
  if (!value) throw new Error("useGame requires GameContext");
  return { setup: value, account: value.account, network: value.network };
};
