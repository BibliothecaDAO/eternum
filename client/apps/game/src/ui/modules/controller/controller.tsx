import { useAccountStore } from "@/hooks/store/use-account-store";
import Button from "@/ui/design-system/atoms/button";
import { useConnect } from "@starknet-react/core";
import { useCallback, useEffect, useState } from "react";

export const Controller = () => {
  const [userName, setUserName] = useState<string>();

  const { connect, connectors } = useConnect();
  const { connector, account } = useAccountStore((state) => state);

  const connectWallet = () => {
    try {
      console.log("Attempting to connect wallet...");
      connect({ connector: connectors[0] });
      console.log("Wallet connected successfully.");
    } catch (error) {
      console.error("Failed to connect wallet:", error);
    }
  };

  const handleConnect = useCallback(() => {
    if (!account) {
      connectWallet();
    }
  }, [connector, account, connectWallet]);

  useEffect(() => {
    if (!connector || !connector!.controller) return;

    try {
      connector.controller.username()?.then((name) => setUserName(name));
    } catch (error) {
      // controller in local
      setUserName("adventurer");
    }
  }, [connector]);

  const handleInventoryClick = useCallback(() => {
    if (!connector?.controller) {
      console.error("Connector not initialized");

      return;
    }
    connector.controller.openProfile("inventory");
  }, [connector]);

  return account ? (
    <Button variant="default" className="bg-dark-wood !pb-0 !pt-0" onClick={handleInventoryClick}>
      {userName && userName.length > 8 ? `${userName.substring(0, 8)}...` : userName}
    </Button>
  ) : (
    <Button className="bg-dark-wood !pb-0 !pt-0" variant="default" onClick={handleConnect}>
      Login
    </Button>
  );
};
