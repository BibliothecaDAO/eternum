import { ReactComponent as CartridgeSmall } from "@/assets/icons/cartridge-small.svg";
import { useAccountStore } from "@/hooks/store/use-account-store";
import Button from "@/ui/design-system/atoms/button";
import { useConnect } from "@starknet-react/core";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect } from "react";
import { env } from "../../../../env";

export const Controller = () => {
  const { connect, connectors, isPending } = useConnect();
  const { connector, account, accountName, setAccountName } = useAccountStore((state) => state);

  const connectWallet = () => {
    try {
      console.log("Attempting to connect wallet...");
      const connectorToUse = connectors[0];
      if (!connectorToUse) {
        console.error("No Starknet connectors available for Cartridge login");
        return;
      }
      connect({ connector: connectorToUse });
      console.log("Wallet connected successfully.");
      if (connector) {
        connector.controller.username()?.then((name) => setAccountName(name));
      }
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
      connector.controller.username()?.then((name) => setAccountName(name));
    } catch (error) {
      console.error("Failed to get username:", error);
    }
  }, [connector, account]);

  const handleInventoryClick = useCallback(() => {
    if (!connector?.controller) {
      console.error("Connector not initialized");

      return;
    }
    connector.controller.openProfile("inventory");
  }, [connector]);

  if (isPending) {
    return (
      <Button className="bg-dark-wood !pb-0 !pt-0" variant="default" onClick={handleConnect}>
        <div className="flex items-center gap-2">
          <CartridgeSmall className="w-4 h-4 fill-current" />
          <Loader2 className="w-4 h-4 fill-current" />
        </div>
      </Button>
    );
  }

  return account ? (
    <Button variant="default" className="bg-dark-wood !pb-0 !pt-0" onClick={handleInventoryClick}>
      <div className="flex items-center gap-2">
        <CartridgeSmall className="w-4 h-4 fill-current" />
        {accountName && accountName.length > 8 ? `${accountName.substring(0, 8)}...` : accountName}
      </div>
    </Button>
  ) : (
    <Button className="bg-dark-wood !pb-0 !pt-0" variant="default" onClick={handleConnect}>
      <div className="flex items-center gap-2">
        <CartridgeSmall className="w-4 h-4 fill-current" />
        Login
      </div>
    </Button>
  );
};
