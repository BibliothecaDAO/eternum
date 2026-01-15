import { useEffect } from "react";

import { useAccountStore } from "@/hooks/store/use-account-store";
import ControllerConnector from "@cartridge/connector/controller";
import { useAccount } from "@starknet-react/core";
import { AccountInterface } from "starknet";

export const useControllerAccount = () => {
  const { account, connector, isConnected } = useAccount();
  const setAccount = useAccountStore((state) => state.setAccount);
  const setConnector = useAccountStore((state) => state.setConnector);

  useEffect(() => {
    if (account) {
      setAccount(account as AccountInterface);
      return;
    }

    const controller = (connector as ControllerConnector | undefined)?.controller;
    if (controller?.account) {
      setAccount(controller.account as AccountInterface);
    } else if (!isConnected) {
      setAccount(null);
    }
  }, [account, connector, isConnected, setAccount]);

  useEffect(() => {
    const normalisedConnector = connector ? (connector as unknown as ControllerConnector) : null;
    setConnector(normalisedConnector);
  }, [connector, isConnected, setConnector]);

  return account ?? (connector as ControllerConnector | undefined)?.controller?.account ?? null;
};
