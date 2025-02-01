import { BridgeTable } from "@/components/modules/realms/bridge-table";
import { Button } from "@/components/ui/button";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import EthereumIcon from "@/components/icons/ethereum.svg";
import StarknetIcon from "@/components/icons/starknet.svg";
import { ArrowLeftRight, Check, ChevronRight } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { marketPlaceClientBuilder } from "@/lib/ark/client";
import { useAccount } from "@starknet-react/core";
import { realmsQueryOptions } from "@/queryOptions/realmsQueryOptions";
import { CollectionAddresses, ChainId } from "@/lib/contracts";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useL1Tokens } from "@/hooks/bridge/data/useL1Tokens";
import { useAccount as useL1Account } from "wagmi";
import { EthereumConnect } from "@/components/layout/ethereum-connect";
import { useToast } from "@/hooks/use-toast";
import { useWriteDepositRealms } from "@/hooks/bridge/useWriteDepositRealms";
import { trpc } from "@/router";

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

export const Route = createFileRoute("/realms/bridge")({
  component: RouteComponent,
  loader: async ({ context: { trpcQueryUtils } }) => {
    await trpcQueryUtils.posts.ensureData()
    return
  },
});

function RouteComponent() {
  const { address: l1Address } = useL1Account();

  const l1RealmsQuery = trpc.posts.useQuery();
  const posts = l1RealmsQuery.data || []

  const arkClient = marketPlaceClientBuilder(window.fetch.bind(window));
  const { address: l2Address } = useAccount();
  const { data: realms } = useSuspenseQuery(
    realmsQueryOptions({
      walletAddress: l2Address ?? "",
      client: arkClient,
      collectionAddress: CollectionAddresses.realms[ChainId.SN_MAIN] as string,
    })
  );
  /* const { data: tokens, isLoading } = useL1Tokens({
    address: l1Address,
    //continuation: "",
  });*/
  const [selectedAsset, setSelectedAsset] = useState<"Ethereum" | "Starknet">(
    "Ethereum"
  );
  const [selectedRows, setSelectedRows] = useState<any[]>([]);
  const { toast } = useToast();

  const handleSelectedRowsChange = (rows: any[]) => {
    setSelectedRows(rows);
  };

  const swapAssets = () => {
    setSelectedAsset((prev) => (prev === "Ethereum" ? "Starknet" : "Ethereum"));
  };
  const mappedRealms = useMemo(() => {
    if (selectedAsset === "Ethereum") {
      return (
        /*tokens?.tokens?.map((realm) => ({
          token_id: realm.token?.tokenId,
          name: realm.token?.name,
          attributes: realm.token?.attributes,
        })) ??*/ []
      );
    } else {
      return (
        realms?.data.map((realm) => ({
          token_id: realm.token_id,
          name: realm.metadata?.name,
          attributes: realm.metadata?.attributes,
        })) ?? []
      );
    }
  }, [selectedAsset, realms]);

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

  const onBridge = async () => {
    let hash;
    if (selectedAsset === "Ethereum") {
      if (!l2Address) throw new Error("Missing L2 Address");
      hash = await depositRealms({
        tokenIds: selectedRows.map((row) => BigInt(row.getValue("token_id"))),
        l2Address: l2Address,
      });
    } else {
      // hash = await initiateWithdraw();
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
    <SidebarProvider
      style={{
        "--sidebar-width": "26rem",
        "--sidebar-width-mobile": "26rem",
      }}
      className="flex flex-1"
    >
      <SidebarInset className="px-6">
        <div className="flex items-center space-x-4 justify-center my-8">
          <Button
            size="lg"
            className={`rounded-full cursor-default bg-primary/80 hover:bg-primary/80`}
          >
            From:
            {selectedAsset === "Ethereum" ? (
              <>
                <EthereumIcon className="!w-6 !h-6" />
                Ethereum
              </>
            ) : (
              <>
                <StarknetIcon className="!w-6 !h-6" />
                Starknet
              </>
            )}
          </Button>
          <Button size="icon" onClick={swapAssets} className="rounded">
            <ArrowLeftRight className="w-7 h-7" />
          </Button>
          <Button size="lg" className="rounded-full" onClick={swapAssets}>
            To:
            {selectedAsset === "Ethereum" ? (
              <>
                <StarknetIcon className="!w-6 !h-6" />
                Starknet
              </>
            ) : (
              <>
                <EthereumIcon className="!w-6 !h-6" />
                Ethereum
              </>
            )}
          </Button>
        </div>

        <BridgeTable
          realms={mappedRealms}
          onSelectedRowsChange={handleSelectedRowsChange}
        />
      </SidebarInset>
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
          Bridging {selectedRows.length} Realms
        </SidebarHeader>
        <SidebarContent className="p-2">
          <SidebarGroup>
            <div className="flex gap-2 mb-4 flex-wrap">
              {selectedRows.map((row) => (
                <span className="border text-sm rounded p-1">
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
                    {data.map((transaction, index) => (
                      <li
                        key={transaction.txHash}
                        className="flex items-center justify-between p-2 border-b"
                      >
                        <div className="flex-1">
                          <div>Tx Hash: {transaction.txHash}</div>
                          <div>Time: {transaction.time}</div>
                          <div>Status: {transaction.status}</div>
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
    </SidebarProvider>
  );
}
