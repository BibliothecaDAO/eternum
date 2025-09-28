import { useEffect } from "react";

import { useAccountStore } from "@/hooks/store/use-account-store";
import ControllerConnector from "@cartridge/connector/controller";
import { useAccount } from "@starknet-react/core";

export const useControllerAccount = () => {
  const { account, connector, isConnected } = useAccount();
  const setAccount = useAccountStore((state) => state.setAccount);
  const setConnector = useAccountStore((state) => state.setConnector);

  useEffect(() => {
    if (!account) {
      return;
    }

    setAccount(account);
  }, [account, isConnected, setAccount]);

  useEffect(() => {
    if (!connector) {
      return;
    }

    setConnector(connector as unknown as ControllerConnector);
  }, [connector, isConnected, setConnector]);

  return account;
};
