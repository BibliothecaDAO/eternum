import { EthereumConnect } from "@/components/layout/ethereum-connect";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@radix-ui/react-collapsible";
import { Row } from "@tanstack/react-table";
import { ChevronRight } from "lucide-react";
import { Realm } from "./bridge-table";
import { useWriteDepositRealms } from "@/hooks/bridge/useWriteDepositRealms";
import { useWriteInitiateWithdrawRealms } from "@/hooks/bridge/useWriteInitiateWithdrawRealms";
import { useToast } from "@/hooks/use-toast";
import { useAccount as useL1Account } from "wagmi";
import { useAccount } from "@starknet-react/core";
import { trpc } from "@/router";

interface BridgeSidebarProps {
  selectedRows: Row<Realm>[];
  selectedAsset: string;
}
export type Transaction = {
  txHash: string;
  time: string;
  status: string;
};

const data: Transaction[] = [
  {
    txHash: "0x1234567890abcdef",
    time: "2023-10-01 12:00:00",
    status: "Pending",
  },
  {
    txHash: "0xabcdef1234567890",
    time: "2023-10-01 12:05:00",
    status: "Confirmed",
  },
  {
    txHash: "0x7890abcdef123456",
    time: "2023-10-01 12:10:00",
    status: "Failed",
  },
];
const BridgeSidebar: React.FC<BridgeSidebarProps> = ({
  selectedRows,
  selectedAsset,
}) => {
  const { address: l1Address } = useL1Account();
  const { address: l2Address } = useAccount();
  const { toast } = useToast();


  const bridgeTxsQuery = trpc.bridgeTransactions.useQuery({l1Account: l1Address, l2Account: l2Address});
  const bridgeTxs = bridgeTxsQuery.data || []
  
  const {
    writeAsync: depositRealms,
    isPending: isDepositPending,
    data: depositData,
  } = useWriteDepositRealms({
    onSuccess: (data: string) => {
      toast({
        title: "Initating Realms Bridge to Starknet",
        description: `Realms will appear in your L2 wallet in a few minutes`,
      });
    },
  });

  const tokenIds = selectedRows.map((row) => row.getValue("token_id") as string);
  console.log(bridgeTxs)
  const {
    sendAsync: initiateWithdraw,
    isPending: isWithdrawPending,
    data: withdrawData,
  } = useWriteInitiateWithdrawRealms({
    selectedTokenIds: tokenIds,
  });

  const onBridge = async () => {

    let hash;
    if (selectedAsset === "Ethereum") {
      if (!l2Address) throw new Error("Missing L2 Address");
      hash = await depositRealms({
        tokenIds: tokenIds.map((id) => BigInt(id)),
        l2Address: l2Address,
      });
    } else {
      hash = await initiateWithdraw();
    }
    if (hash) {
      toast({
        title: "Bridge Realms",
        description:
          selectedAsset === "Ethereum"
            ? `${selectedRows.length} Realms will be appear in your L2 wallet in a few minutes`
            : `${selectedRows.length} Realms will require a transction in ~6 hours to finalize your withdrawal`,
      });
    }
  };

  return (
    <Sidebar
      side="right"
      variant="inset"
      className="top-[--header-height] !h-[calc(100svh-var(--header-height))]"
    >
      <div className="flex text-sm items-center justify-between">
        Ethereum Wallet:
        <EthereumConnect />
      </div>
      <SidebarSeparator className="mx-0 mt-2" />
      <SidebarHeader className="text-xl border-b">
        Bridging {selectedRows.length} Realms to{" "}
        {selectedAsset === "Ethereum" ? "Starknet" : "Ethereum"}
      </SidebarHeader>
      <SidebarContent className="p-2">
        <SidebarGroup>
          <div className="flex gap-2 mb-4 flex-wrap">
            {selectedRows.map((row) => (
              <span
                className="border text-sm rounded p-1"
                key={row.getValue("token_id")}
              >
                #{row.getValue("token_id")}
              </span>
            ))}
          </div>
          <Button
            disabled={!selectedRows.length}
            className="w-full"
            onClick={onBridge}
          >
            {!selectedRows.length
              ? "Select Realms"
              : `Bridge to ${selectedAsset}`}
          </Button>
        </SidebarGroup>
        <SidebarSeparator className="mx-0 mt-4" />

        <Collapsible className="group/collapsible">
          <SidebarGroupLabel
            asChild
            className="group/label w-full text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <CollapsibleTrigger>
              Transaction History
              <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
            </CollapsibleTrigger>
          </SidebarGroupLabel>
          <CollapsibleContent>
            <SidebarGroupContent>
              <div>
                <ul>
                  {bridgeTxs?.map((transaction) => (
                    <li
                      key={transaction.id}
                      className="flex items-center justify-between p-2 border-b"
                    >
                      <div className="flex-1">
                        <div>Tx Hash: {transaction.hash}</div>
                        <div>Time: {transaction.timestamp.toLocaleString()}</div>
                        <div>From chain: {transaction.from_chain}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </SidebarGroupContent>
          </CollapsibleContent>
        </Collapsible>
        <SidebarSeparator className="mx-0" />
      </SidebarContent>
    </Sidebar>
  );
};

export default BridgeSidebar;
