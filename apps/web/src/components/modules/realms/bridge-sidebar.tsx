import type { BridgeRealm } from "@/types/ark";
import type { Row, RowSelectionState } from "@tanstack/react-table";
import { Suspense, useMemo } from "react";
import { EthereumConnect } from "@/components/layout/ethereum-connect";
import { StarknetWalletButton } from "@/components/layout/starknet-wallet-button";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { useBridgeL2Realms } from "@/hooks/bridge/useBridgeL2Realms";
import { useWriteDepositRealms } from "@/hooks/bridge/useWriteDepositRealms";
import useERC721Approval from "@/hooks/token/L1/useERC721Approval";
import { useToast } from "@/hooks/use-toast";
import { useAccount } from "@starknet-react/core";
import { ChevronRight } from "lucide-react";
import { useAccount as useL1Account } from "wagmi";

import BridgeTransactionItems from "./bridge-tx-items";
import BridgeTransactionHistorySkeleton from "./bridge-tx-skeleton";

interface BridgeSidebarProps {
  selectedRows: Row<BridgeRealm>[];
  selectedAsset: string;
  setRowSelection: (rowSelection: RowSelectionState) => void;
}

const BridgeSidebar: React.FC<BridgeSidebarProps> = ({
  selectedRows,
  selectedAsset,
  setRowSelection,
}) => {
  const { address: l1Address } = useL1Account();
  const { address: l2Address } = useAccount();
  const { toast } = useToast();

  const { writeAsync: depositRealms, isPending: isDepositPending } =
    useWriteDepositRealms({
      onSuccess: () => {
        toast({
          title: "Initating Realms Bridge to Starknet",
          description: `Realms will appear in your L2 wallet in a few minutes`,
        });
      },
    });

  const tokenIds: string[] = useMemo(
    () => selectedRows.map((row) => row.getValue("token_id")),
    [selectedRows],
  );

  const {
    isApprovedForAll,
    approveForAll,
    approveForAllLoading,
    isPending: isApproveForAllPending,
  } = useERC721Approval();

  const { initiateWithdraw, isPending: isWithdrawPending } = useBridgeL2Realms({
    selectedTokenIds: tokenIds,
  });

  const onBridge = async () => {
    let hash: string | undefined;
    if (selectedAsset === "Ethereum") {
      if (!l2Address) throw new Error("Missing L2 Address");
      if (!isApprovedForAll) {
        await approveForAll();
      }
      hash = await depositRealms({
        tokenIds: tokenIds.map((id) => BigInt(id)),
        l2Address: l2Address,
      });
    } else {
      hash = (await initiateWithdraw()).transaction_hash;
    }
    if (hash) {
      toast({
        title: "Bridge Realms",
        description:
          selectedAsset === "Ethereum"
            ? `${selectedRows.length} Realms will be appear in your L2 wallet in a few minutes`
            : `${selectedRows.length} Realms will require a transction in ~6 hours to finalize your withdrawal`,
      });
      setRowSelection({});
    }
  };

  return (
    <Sidebar
      side="right"
      variant="inset"
      className="top-(--header-height) h-[calc(100svh-var(--header-height))]!"
    >
      <div className="flex items-center justify-end gap-2 text-sm">
        Ethereum Wallet:
        <EthereumConnect />
      </div>
      <SidebarSeparator className="mx-0 mt-2" />
      <SidebarHeader>
        <div className="border-b pb-2 text-xl">
          Bridging {selectedRows.length} Realms to
          {selectedAsset === "Ethereum" ? " Starknet" : " Ethereum"}
        </div>
        <SidebarGroup>
          <div className="mb-4 flex flex-wrap gap-2">
            {selectedRows.map((row) => (
              <span
                className="rounded border p-1 text-sm"
                key={row.getValue("token_id")}
              >
                #{row.getValue("token_id")}
              </span>
            ))}
          </div>
          {!l1Address ? (
            <EthereumConnect label="Connect Ethereum To Bridge" />
          ) : !l2Address ? (
            <StarknetWalletButton label="Connect Starknet To Bridge" />
          ) : selectedAsset === "Ethereum" && !isApprovedForAll ? (
            <Button
              disabled={approveForAllLoading || isApproveForAllPending}
              className="w-full"
              onClick={onBridge}
            >
              {isApproveForAllPending ? "Approving" : `Approve Bridge`}
            </Button>
          ) : (
            <Button
              disabled={
                !selectedRows.length || isDepositPending || isWithdrawPending
              }
              className="w-full"
              onClick={onBridge}
            >
              {!selectedRows.length ? "Select Realms" : `Bridge`}
            </Button>
          )}
        </SidebarGroup>
      </SidebarHeader>
      <SidebarContent className="p-2">
        <SidebarSeparator className="mx-0 mt-4" />

        <Collapsible defaultOpen className="group/collapsible">
          <SidebarGroupLabel
            asChild
            className="group/label text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground w-full text-sm"
          >
            <CollapsibleTrigger className="bg-sidebar-accent h-10">
              Transaction History
              <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
            </CollapsibleTrigger>
          </SidebarGroupLabel>
          <CollapsibleContent>
            <SidebarGroupContent>
              <Suspense fallback={<BridgeTransactionHistorySkeleton />}>
                {(l1Address ?? l2Address) && <BridgeTransactionItems />}
              </Suspense>
            </SidebarGroupContent>
          </CollapsibleContent>
        </Collapsible>
      </SidebarContent>
    </Sidebar>
  );
};

export default BridgeSidebar;
