import { ReactComponent as CartridgeSmall } from "@/assets/icons/cartridge-small.svg";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { BuildingThumbs } from "@/ui/config";
import Button from "@/ui/elements/button";
import CircleButton from "@/ui/elements/circle-button";
import { useConnect, useDisconnect } from "@starknet-react/core";
import { useCallback, useEffect, useState } from "react";

export const Controller = ({ className, iconClassName }: { className?: string; iconClassName?: string }) => {
  const [userName, setUserName] = useState<string>();
  const setBlankOverlay = useUIStore((state) => state.setShowBlankOverlay);

  const { connect, connectors } = useConnect();
  const { connector, account, setAccount } = useAccountStore();
  const { disconnect } = useDisconnect();

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

  const handleConnected = useCallback(() => {
    connector?.controller?.openProfile("inventory");
  }, [connector]);

  const handleDisconnect = useCallback(() => {
    disconnect();
    setAccount(null);
    setBlankOverlay(true);
  }, [disconnect]);

  useEffect(() => {
    if (!connector || !connector!.controller) return;

    try {
      connector.controller.username()?.then((name) => setUserName(name));
    } catch (error) {
      // controller in local
      setUserName("adventurer");
    }
  }, [connector]);

  return account ? (
    <>
      <Button onClick={handleConnected}>
        <CartridgeSmall className={`w-6 md:w-6 mr-1 md:mr-1 !fill-currentself-center ${iconClassName}`} />
        <div className="align-center">{userName}</div>
      </Button>
      <CircleButton image={BuildingThumbs.leave} size="md" onClick={handleDisconnect}></CircleButton>
    </>
  ) : (
    <CircleButton image={BuildingThumbs.leave} size="md" onClick={handleConnect}></CircleButton>
  );
};
