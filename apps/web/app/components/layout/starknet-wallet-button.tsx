import { useEffect, useState } from "react";
import { useAccount, useConnect } from "@starknet-react/core";
import type {
  Connector,
  StarknetkitConnector} from "starknetkit";
import {
  useStarknetkitConnectModal,
} from "starknetkit";
import { Button } from "../ui/button";
import { getConnectorIcon, getLastConnector } from "@/utils/connectWallet";
import { ArrowDownIcon } from "lucide-react";
import { Separator } from "../ui/separator";

export const StarknetWalletButton = () => {
  const { isConnected } = useAccount();
  const { connectAsync, connectors } = useConnect();
  const [lastConnector, setLastConnector] = useState<Connector | null>(null);

  const { starknetkitConnectModal } = useStarknetkitConnectModal({
    connectors: connectors as StarknetkitConnector[],
  });

  useEffect(() => {
    setLastConnector(getLastConnector(connectors));
  }, [isConnected, connectors]);

  async function openStarknetKitModal() {
    const { connector } = await starknetkitConnectModal();
    if (!connector) {
      return;
    }

    await connectAsync({ connector });
  }

  const connectWallet = async (connector: Connector) => {
    await connectAsync({ connector: connector });
    localStorage.setItem("connectedWallet", connector.id);
  };

  return (
    <>
      <Button
        onClick={
          lastConnector
            ? () => connectWallet(lastConnector)
            : () => openStarknetKitModal()
        }
        className="px-2.5 rounded"
      >
        <div className="flex items-center">
          {lastConnector ? (
            <img className="pr-2" src={getConnectorIcon(lastConnector.id)} />
          ) : null}
          <p className="mx-auto">Connect wallet</p>
          {lastConnector ? (
            <>
              <Separator orientation="vertical" className="h-6 ml-3 mr-1.5" />

              <div
                className="hover:bg-background/20 p-1"
                onClick={(e) => {
                  openStarknetKitModal();
                  e.stopPropagation();
                }}
              >
                <ArrowDownIcon width="18" />
              </div>
            </>
          ) : null}
        </div>
      </Button>
    </>
  );
};
