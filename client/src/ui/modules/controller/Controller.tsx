import { ReactComponent as CartridgeSmall } from "@/assets/icons/cartridge-small.svg";
import { ReactComponent as Disconnect } from "@/assets/icons/disconnect.svg";
import { useAccountStore } from "@/hooks/context/accountStore";
import useUIStore from "@/hooks/store/useUIStore";

import Button from "@/ui/elements/Button";
import { useConnect, useDisconnect } from "@starknet-react/core";
import { useCallback, useEffect, useState } from "react";

export const Controller = ({ className, iconClassName }: { className?: string; iconClassName?: string }) => {
  const [userName, setUserName] = useState<string>();
  const setBlankOverlay = useUIStore((state) => state.setShowBlankOverlay);

  const { connect, connectors } = useConnect();
  const { connector, account, setAccount } = useAccountStore();
  const { disconnect } = useDisconnect();

  const connectWallet = async () => {
    try {
      console.log("Attempting to connect wallet...");
      await connect({ connector: connectors[0] });
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

    connector.controller.username()?.then((name) => setUserName(name));
  }, [connector]);

  return account ? (
    <>
      <Button
        className={`flex items-center hover:scale-105 hover:-translate-y-1 shadow-[0px_4px_4px_0px_#00000040] rounded-md !h-8 !w-28 !text-gold !text-md !px-3 normal-case font-normal border !border-[#F5C2971F] backdrop-blur-xs  !text-gold !bg-[#0000007A] hover:!opacity-80 ${className}`}
        onClick={handleConnected}
      >
        <CartridgeSmall className={`w-6 md:w-6 mr-1 md:mr-1 !fill-current text-gold self-center ${iconClassName}`} />
        <div className="align-center">{userName}</div>
      </Button>
      <Button
        className={`flex items-center hover:scale-105 hover:-translate-y-1 shadow-[0px_4px_4px_0px_#00000040] rounded-md !h-8 !w-12 border !border-[#F5C2971F] backdrop-blur-xs !text-gold !bg-[#0000007A] hover:!opacity-80  !text-md !px-3 ${className}`}
        onClick={handleDisconnect}
      >
        <Disconnect className={`self-center !w-8 !h-8 !fill-current !text-gold`} />
      </Button>
    </>
  ) : (
    <Button
      className={`flex items-center hover:scale-105 hover:-translate-y-1 shadow-[0px_4px_4px_0px_#00000040] rounded-md !h-8 bg-black text-gold !text-md !px-3 ${className}`}
      variant="default"
      size="md"
      onClick={handleConnect}
    >
      <CartridgeSmall className={`w-10 md:w-6 mr-1 md:mr-1 fill-gold self-center ${iconClassName}`} />
      <div className="align-center">Log In</div>
    </Button>
  );
};
