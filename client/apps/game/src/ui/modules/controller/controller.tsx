import { ReactComponent as CartridgeSmall } from "@/assets/icons/cartridge-small.svg";
import { connectWithControllerRetry, pickPrimaryConnector } from "@/hooks/context/controller-connect";
import { useAccountStore } from "@/hooks/store/use-account-store";
import Button from "@/ui/design-system/atoms/button";
import { useConnect } from "@starknet-react/core";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import { useCallback, useEffect } from "react";

interface ControllerProps {
  className?: string;
}

export const Controller = ({ className = "" }: ControllerProps) => {
  const { connectAsync, connectors, isPending } = useConnect();
  const { connector, account, accountName, setAccountName } = useAccountStore((state) => state);

  const connectWallet = useCallback(async () => {
    try {
      console.log("Attempting to connect wallet...");
      const connectorToUse = pickPrimaryConnector(connectors);
      if (!connectorToUse) {
        console.error("No Starknet connectors available for Cartridge login");
        return;
      }

      await connectWithControllerRetry(connectAsync, connectorToUse);
      console.log("Wallet connected successfully.");

      if (connector) {
        connector.controller.username()?.then((name) => setAccountName(name));
      }
    } catch (error) {
      console.error("Failed to connect wallet:", error);
    }
  }, [connectAsync, connector, connectors, setAccountName]);

  const handleConnect = useCallback(() => {
    if (!account && !isPending) {
      void connectWallet();
    }
  }, [account, connectWallet, isPending]);

  useEffect(() => {
    if (!connector || !connector!.controller) return;

    try {
      connector.controller.username()?.then((name) => setAccountName(name));
    } catch (error) {
      console.error("Failed to get username:", error);
    }
  }, [account, connector, setAccountName]);

  const handleInventoryClick = useCallback(() => {
    if (!connector?.controller) {
      console.error("Connector not initialized");

      return;
    }
    connector.controller.openProfile("inventory");
  }, [connector]);

  if (isPending) {
    return (
      <Button
        className={`bg-dark-wood !pb-0 !pt-0 h-9 px-4 min-w-[96px] ${className}`}
        variant="default"
        onClick={handleConnect}
      >
        <div className="flex items-center gap-2">
          <CartridgeSmall className="w-4 h-4 fill-current" />
          <Loader2 className="w-4 h-4 fill-current" />
        </div>
      </Button>
    );
  }

  return account ? (
    <Button
      // variant="default"
      className={`h-9 px-4 min-w-[96px] ${className}`}
      onClick={handleInventoryClick}
    >
      <div className="flex items-center gap-2">
        <CartridgeSmall className="w-4 h-4 fill-current" />
        {accountName && accountName.length > 8 ? `${accountName.substring(0, 8)}...` : accountName}
      </div>
    </Button>
  ) : (
    <Button
      className={`h-9 px-4 min-w-[96px] ${className}`}
      // variant="default"
      onClick={handleConnect}
    >
      <div className="flex items-center gap-2">
        <CartridgeSmall className="w-4 h-4 fill-current" />
        Login
      </div>
    </Button>
  );
};
