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
import { ArrowRight, ChevronRight } from "lucide-react";
import { Realm } from "./bridge-table";
import { useWriteDepositRealms } from "@/hooks/bridge/useWriteDepositRealms";
import { useToast } from "@/hooks/use-toast";
import { useAccount as useL1Account } from "wagmi";
import { useAccount } from "@starknet-react/core";
import { trpc } from "@/router";
import { shortenAddress } from "@/utils/utils";
import { Badge } from "@/components/ui/badge";
import { ChainId} from "@realms-world/constants";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useMemo } from "react";
import useERC721Approval from "@/hooks/token/L1/useERC721Approval";
import { useBridgeL2Realms } from "@/hooks/bridge/useBridgeL2Realms";
import { TransactionChains } from "./bridge-tx-chains";


interface BridgeSidebarProps {
  selectedRows: Row<Realm>[];
  selectedAsset: string;
}

const BridgeSidebar: React.FC<BridgeSidebarProps> = ({
  selectedRows,
  selectedAsset,
}) => {
  const { address: l1Address } = useL1Account();
  const { address: l2Address } = useAccount();
  const { toast } = useToast();

  const bridgeTxsQuery = trpc.bridgeTransactions.useQuery({
    l1Account: l1Address,
    l2Account: l2Address,
  });
  const bridgeTxs = bridgeTxsQuery.data || [];

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



  const tokenIds = useMemo(() => selectedRows.map(
    (row) => row.getValue("token_id") as string
  ), [selectedRows]);

  const {isApprovedForAll, approveForAll, approveForAllLoading} = useERC721Approval();
  
  const {
    initiateWithdraw,
    isPending: isWithdrawPending,
    data: withdrawData,
  } = useBridgeL2Realms({ selectedTokenIds: tokenIds });

  const onBridge = async () => {
    let hash;
    if (selectedAsset === "Ethereum") {
      if (!l2Address) throw new Error("Missing L2 Address");
      if (!isApprovedForAll) {
        await approveForAll();
      }
      hash = await depositRealms({
        tokenIds: tokenIds.map((id) => BigInt(id)),
        l2Address: l2Address,
      });
      console.log(hash);
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
              : isApprovedForAll ? `Bridge` : `Approve Bridge`}
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
              <Accordion type="single" collapsible className="grid gap-4">
                {bridgeTxs?.map((transaction) => (
                  <AccordionItem key={transaction.id} value={transaction.id}>
                    <AccordionTrigger className="flex hover:no-underline w-full justify-between">
                      <div className="flex w-full justify-between px-2">
                        <div>
                          <div className="flex items-center gap-2">
                          <TransactionChains fromChain={transaction.from_chain} />
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {transaction.timestamp.toLocaleString()}
                          </span>
                        </div>
                        <div>
                          {transaction.token_ids.slice(0, 3).map((id) => (
                            <Badge variant="outline" className="w-fit" key={id}>
                              #{id}
                            </Badge>
                          ))}
                          {transaction.token_ids.length > 3 && (
                            <Badge key="more">
                              +{transaction.token_ids.length - 3}
                            </Badge>
                          )}
                        </div>
                        {transaction.events[0].type === "withdraw_available_l1" && <Button variant="outline" className="border-green-500" >Complete Withdraw</Button>}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <Badge variant="outline" className="w-fit">
                        {shortenAddress(transaction.hash)}
                      </Badge>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </SidebarGroupContent>
          </CollapsibleContent>
        </Collapsible>
      </SidebarContent>
    </Sidebar>
  );
};

export default BridgeSidebar;
