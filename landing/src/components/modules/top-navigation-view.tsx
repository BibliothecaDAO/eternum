import { displayAddress } from "@/lib/utils";
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
  accountAddress,
}: TopNavigationViewProps) => {
  return (
    <div className="flex justify-between items-center w-full p-2">
      <div className="flex items-center">
        <SidebarTrigger />
      </div>
      <div className="flex gap-2">
        <ModeToggle />

        {lordsBalance ? (
          <div className="text-sm p-2 rounded border">{formatEther(uint256.uint256ToBN(lordsBalance))} Lords</div>
        ) : null}

        <Button onClick={onMintTestLords}>Mint Test Lords</Button>

        <>
          {connectors.map((connector, index) => (
            <Button size={"default"} key={index} onClick={() => onConnect(connector)} variant="outline">
              <img className="w-5" src={typeof connector.icon === "string" ? connector.icon : connector.icon.dark} />{" "}
            </Button>
          ))}
        </>
        <Button size={"default"} onClick={onDisconnect}>
          {accountAddress ? displayAddress(accountAddress) : ""}
        </Button>
      </div>
    </div>
  );
};
