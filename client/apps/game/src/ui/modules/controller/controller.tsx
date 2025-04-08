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
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);

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

  const handleDisconnect = useCallback(() => {
    disconnect();
    setAccount(null);
    setBlankOverlay(true);
    setShowDisconnectConfirm(false);
  }, [disconnect, setAccount, setBlankOverlay]);

  const handleShowDisconnect = useCallback(() => {
    setShowDisconnectConfirm(true);
  }, []);

  const handleCancelDisconnect = useCallback(() => {
    setShowDisconnectConfirm(false);
  }, []);

  useEffect(() => {
    if (!connector || !connector!.controller) return;

    try {
      connector.controller.username()?.then((name) => setUserName(name));
    } catch (error) {
      // controller in local
      setUserName("adventurer");
    }
  }, [connector]);

  useEffect(() => {
    if (!account) {
      setShowDisconnectConfirm(false);
    }
  }, [account]);

  return account ? (
    <>
      {showDisconnectConfirm ? (
        <>
          <Button className="bg-dark-wood !pb-0" variant="danger" onClick={handleCancelDisconnect}>
            Close
          </Button>
          <CircleButton label="Logout" image={BuildingThumbs.leave} size="md" onClick={handleDisconnect}></CircleButton>
        </>
      ) : (
        <Button variant="default" className="!pb-0 bg-dark-wood" onClick={handleShowDisconnect}>
          {/* <CartridgeSmall className={`w-5 md:w-4 mr-1 md:mr-1 !fill-current self-center ${iconClassName}`} /> */}
          <div className="self-center">{userName}</div>
        </Button>
      )}
    </>
  ) : (
    <Button className="bg-dark-wood !pb-0" variant="default" onClick={handleConnect}>
      Login
    </Button>
  );
};
