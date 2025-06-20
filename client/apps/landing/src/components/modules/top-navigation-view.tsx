import { displayAddress } from "@/lib/utils";
import ControllerConnector from "@cartridge/connector/controller";
import { ExitIcon } from "@radix-ui/react-icons";
import { useAccount } from "@starknet-react/core";
import { ArrowDownUp, CoinsIcon, PlayIcon } from "lucide-react";
import { Button } from "../ui/button";
import { ResourceIcon } from "../ui/elements/resource-icon";
import { SidebarTrigger } from "../ui/sidebar";
import { ModeToggle } from "./mode-toggle";
import { SeasonStartTimer } from "./season-start-timer";

interface TopNavigationViewProps {
  lordsBalance: bigint;
  onMintTestLords: () => Promise<void>;
  connectors: any[];
  onConnect: (connector: any) => void;
  onDisconnect: () => void;
  accountAddress?: string;
}

export const TopNavigationView = ({
  lordsBalance,
  onMintTestLords,
  connectors,
  onConnect,
  onDisconnect,
}: TopNavigationViewProps) => {
  const { address, connector, isConnected } = useAccount();

  const chain = import.meta.env.VITE_PUBLIC_CHAIN;

  return (
    <div className="flex justify-between items-center w-full p-2 max-w-[100vw] overflow-y-auto">
      <div className="flex items-center gap-4">
        <SidebarTrigger />
        <ModeToggle />

        {chain === "sepolia" && (
          <Button variant="outline" onClick={onMintTestLords}>
            Mint Lords
          </Button>
        )}

        <div className="text-sm text-primary border border-primary/40 rounded-md px-2 py-2 flex items-center gap-2">
          {(lordsBalance / 10n ** 18n).toLocaleString("en-US")}
          <ResourceIcon size="sm" resource="Lords" className="w-4 h-4" />
        </div>

        <Button
          disabled={false}
          variant="cta"
          onClick={() => {
            window.open(
              chain === "sepolia" ? "https://dev.eternum.realms.world" : "https://eternum.realms.world",
              "_blank",
            );
          }}
          className="gap-2 hidden sm:flex"
        >
          <PlayIcon className="!w-4 h-2" />
          {chain === "sepolia" ? "Play Eternum (Sepolia)" : "Play Eternum (Mainnet)"}
        </Button>

        <Button
          variant="outline"
          onClick={() => {
            window.open("https://discord.gg/realmsworld", "_blank");
          }}
          className="gap-2 hidden lg:flex"
        >
          <img src="/images/buildings/thumb/discord.png" alt="Discord" className="w-4 h-4" />
          Discord
        </Button>
      </div>
      <SeasonStartTimer />
      {/* <SeasonRegistrationTimer /> */}
      <div className="flex gap-2 justify-between">
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
              <Button size={"default"} key={index} onClick={() => onConnect(connector)} variant="outline">
                <img
                  className="w-5"
                  src={typeof connector.icon === "string" ? connector.icon : connector.icon.dark}
                />{" "}
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
                onDisconnect();
              }
            }}
          >
            <img className="w-5" src={typeof connector?.icon === "string" ? connector?.icon : connector?.icon.dark} />{" "}
            {address ? displayAddress(address) : ""}
          </Button>
        )}
        {isConnected ? (
          <Button
            variant="outline"
            className="px-1"
            size={"default"}
            onClick={() => {
              onDisconnect();
            }}
          >
            <ExitIcon />
          </Button>
        ) : null}
      </div>
    </div>
  );
};
