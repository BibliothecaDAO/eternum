import { useLords } from "@/hooks/use-lords";
import { useMintTestLords } from "@/hooks/use-mint-test-lords";
import { displayAddress } from "@/lib/utils";
import ControllerConnector from "@cartridge/connector/controller";
import { ExitIcon } from "@radix-ui/react-icons";
import { useAccount, useConnect, useDisconnect } from "@starknet-react/core";
import { ArrowDownUp, CoinsIcon, HomeIcon } from "lucide-react";
import { Button } from "../ui/button";
import { ResourceIcon } from "../ui/elements/resource-icon";

export const TopNavigation = () => {
  const { address, connector, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { lordsBalance } = useLords();
  const { mintTestLords } = useMintTestLords();

  const chain = import.meta.env.VITE_PUBLIC_CHAIN;

  const handleConnect = (connector: any) => {
    connect({ connector });
  };

  return (
    <div className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex justify-between items-center w-full p-2 max-w-[100vw] overflow-y-auto">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => {
              window.open(
                chain === "sepolia" ? "https://dev.eternum.realms.world" : "https://eternum.realms.world",
                "_blank",
              );
            }}
            className="gap-2"
          >
            <HomeIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Eternum</span>
          </Button>
        </div>

        <div className="flex gap-2 justify-between items-center">
          <div className="text-sm text-primary border border-primary/40 rounded-md px-2 py-2 flex items-center gap-2">
            {(lordsBalance / 10n ** 18n).toLocaleString("en-US")}
            <ResourceIcon size="sm" resource="Lords" className="w-4 h-4" />
          </div>

          {chain === "sepolia" && (
            <Button variant="outline" onClick={mintTestLords}>
              Mint Lords
            </Button>
          )}

          <Button
            variant="outline"
            onClick={() => {
              const baseUrl = "https://app.ekubo.org/?outputCurrency=LORDS&amount=&inputCurrency=ETH";
              window.open(baseUrl, "_blank");
            }}
            className="gap-2 hidden sm:flex uppercase"
          >
            <ArrowDownUp className="w-4 h-4" />
            Swap
          </Button>

          <Button
            variant="outline"
            onClick={() => {
              const baseUrl =
                "https://app.rhino.fi/bridge?mode=receive&chainIn=ARBITRUM&chainOut=STARKNET&tokenOut=ETH&token=ETH&recipient=";
              const userAddress = address || "";
              window.open(baseUrl + userAddress, "_blank");
            }}
            className="gap-2 hidden lg:flex uppercase"
          >
            <CoinsIcon className="w-4 h-4" />
            Bridge
          </Button>

          {!isConnected ? (
            <>
              {connectors.map((connector, index) => (
                <Button size={"default"} key={index} onClick={() => handleConnect(connector)} variant="outline">
                  <img
                    className="w-5"
                    src={typeof connector.icon === "string" ? connector.icon : connector.icon.dark}
                  />
                </Button>
              ))}
            </>
          ) : (
            <Button
              variant="outline"
              className="gap-2"
              size={"default"}
              onClick={() => {
                if (connector?.id === "controller") {
                  (connector as unknown as ControllerConnector).controller.openProfile("inventory");
                } else {
                  disconnect();
                }
              }}
            >
              <img className="w-5" src={typeof connector?.icon === "string" ? connector?.icon : connector?.icon.dark} />
              {address ? displayAddress(address) : ""}
            </Button>
          )}

          {isConnected && (
            <Button
              variant="outline"
              className="px-1"
              size={"default"}
              onClick={() => {
                disconnect();
              }}
            >
              <ExitIcon />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
