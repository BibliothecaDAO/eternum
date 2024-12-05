import { displayAddress } from "@/lib/utils";
import ControllerConnector from "@cartridge/connector/controller";
import { ExitIcon } from "@radix-ui/react-icons";
import { useAccount } from "@starknet-react/core";
import { Uint256, uint256 } from "starknet";
import { formatEther } from "viem";
import { Button } from "../ui/button";
import { SidebarTrigger } from "../ui/sidebar";
import { ModeToggle } from "./mode-toggle";

interface TopNavigationViewProps {
  lordsBalance: Uint256 | undefined;
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
  //accountAddress,
}: TopNavigationViewProps) => {
  const { address, connector, isConnected } = useAccount();

  return (
    <div className="flex justify-between items-center w-full p-2">
      <div className="flex items-center gap-4">
        <SidebarTrigger />
        <ModeToggle />

        {lordsBalance ? (
          <div className="text-sm p-2 rounded border">
            {Number(formatEther(uint256.uint256ToBN(lordsBalance))).toFixed(2)} Lords
          </div>
        ) : null}

        {import.meta.env.VITE_PUBLIC_DEV === "true" ? (
          <Button disabled={!address} onClick={onMintTestLords}>
            Mint Test Lords
          </Button>
        ) : null}
      </div>
      <div className="flex gap-2 justify-between">
        {!isConnected ? (
          <>
            {connectors.map((connector, index) => (
              <Button size={"default"} key={index} onClick={() => onConnect(connector)} variant="outline">
                <img className="w-5" src={typeof connector.icon === "string" ? connector.icon : connector.icon.dark} />{" "}
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
            className="gap-2"
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
