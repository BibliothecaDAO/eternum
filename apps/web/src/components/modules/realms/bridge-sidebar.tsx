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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import {
  isStarknetAccountDeployed,
  useWriteDepositRealms,
} from "@/hooks/bridge/useWriteDepositRealms";
import useERC721Approval from "@/hooks/token/L1/useERC721Approval";
import { useToast } from "@/hooks/use-toast";
import { useAccount } from "@starknet-start/react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, CircleHelp } from "lucide-react";
import { useAccount as useL1Account } from "wagmi";

import BridgeTransactionItems from "./bridge-tx-items";
import BridgeTransactionHistorySkeleton from "./bridge-tx-skeleton";

interface BridgeSidebarProps {
  disabled: boolean;
  selectedRows: Row<BridgeRealm>[];
  selectedAsset: string;
  setRowSelection: (rowSelection: RowSelectionState) => void;
}

const BridgeSidebar: React.FC<BridgeSidebarProps> = ({
  disabled,
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

  const {
    data: isL2AccountDeployed,
    isLoading: isL2AccountDeploymentLoading,
    error: l2AccountDeploymentError,
  } = useQuery({
    queryKey: ["starknet-account-deployed", l2Address],
    queryFn: async () =>
      l2Address ? isStarknetAccountDeployed(l2Address) : false,
    enabled: selectedAsset === "Ethereum" && !!l2Address,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const shouldBlockL1ToL2Bridge =
    selectedAsset === "Ethereum" &&
    (!!l2AccountDeploymentError ||
      isL2AccountDeploymentLoading ||
      isL2AccountDeployed === false);
  const showDeployHelp =
    selectedAsset === "Ethereum" && isL2AccountDeployed === false;

  const onBridge = async () => {
    try {
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
    } catch (error) {
      toast({
        variant: "destructive",
        description:
          error instanceof Error ? error.message : "Unable to bridge Realms.",
      });
    }
  };

  return (
    <Sidebar
      side="right"
      variant="inset"
      className="top-(--header-height) h-[calc(100svh-var(--header-height))]!"
    >
      <SidebarHeader className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-sm">Ethereum Wallet</span>
          <EthereumConnect />
        </div>
        <SidebarSeparator className="mx-0" />
        <h2 className="realm-card-title">
          Bridging {selectedRows.length} Realms to
          {selectedAsset === "Ethereum" ? " Starknet" : " Ethereum"}
        </h2>
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
            <StarknetWalletButton
              label="Connect Starknet To Bridge"
              variant="reference"
            />
          ) : selectedAsset === "Ethereum" && !isApprovedForAll ? (
            <Button
              disabled={
                approveForAllLoading ||
                isApproveForAllPending ||
                shouldBlockL1ToL2Bridge
              }
              className="w-full"
              onClick={onBridge}
            >
              {isL2AccountDeploymentLoading
                ? "Checking Starknet account..."
                : l2AccountDeploymentError
                  ? "Unable to verify Starknet account"
                  : isL2AccountDeployed === false
                    ? "Deploy Starknet account first"
                    : isApproveForAllPending
                      ? "Approving"
                      : `Approve Bridge`}
            </Button>
          ) : (
            <Button
              disabled={
                disabled ||
                !selectedRows.length ||
                isDepositPending ||
                isWithdrawPending ||
                shouldBlockL1ToL2Bridge
              }
              className="w-full"
              onClick={onBridge}
            >
              {!selectedRows.length
                ? "Select Realms"
                : isL2AccountDeploymentLoading
                  ? "Checking Starknet account..."
                  : l2AccountDeploymentError
                    ? "Unable to verify Starknet account"
                    : isL2AccountDeployed === false
                      ? "Deploy Starknet account first"
                      : `Bridge`}
            </Button>
          )}
          {showDeployHelp && (
            <div className="text-muted-foreground mt-2 text-sm">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" className="h-auto p-0 text-sm">
                    <CircleHelp className="mr-1 h-4 w-4" />
                    How to deploy your Starknet account
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-80 space-y-2">
                  <p>
                    Starknet wallets are smart contracts and must be deployed
                    onchain before L1 to L2 bridging can complete.
                  </p>
                  <ol className="list-decimal space-y-1 pl-4">
                    <li>Fund your wallet with ETH or STRK for gas.</li>
                    <li>
                      Send your first Starknet transaction to trigger account
                      deployment.
                    </li>
                    <li>
                      If you use Argent X, you can also deploy manually in
                      Settings via Deploy account.
                    </li>
                  </ol>
                  <p>Deployment can take up to around 20 minutes.</p>
                  <a
                    href="https://support.argent.xyz/hc/en-us/articles/8802319054237-How-to-activate-deploy-my-Argent-Starknet-wallet"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    Argent deployment guide
                  </a>
                </PopoverContent>
              </Popover>
            </div>
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
            <CollapsibleTrigger className="h-10">
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
