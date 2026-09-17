import { useGame } from "@bibliothecadao/react";

export const isConnectedGameplayAccount = (address: string | undefined): boolean =>
  address !== undefined && BigInt(address) !== 0n;

export const useGameplayAccountAddress = (): string | undefined => {
  const {
    account: { account },
  } = useGame();
  return isConnectedGameplayAccount(account.address) ? account.address : undefined;
};
