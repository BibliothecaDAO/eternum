import { BridgeTable } from "@/components/modules/realms/bridge-table";
import { Button } from "@/components/ui/button";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
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
});

function RouteComponent() {
  const arkClient = marketPlaceClientBuilder(window.fetch.bind(window));
  const { address } = useAccount();

  const { data: realms } = useSuspenseQuery(
    realmsQueryOptions({
      walletAddress: address ?? "",
      client: arkClient,
      collectionAddress: CollectionAddresses.realms[ChainId.SN_MAIN] as string,
    })
  );
  const [selectedAsset, setSelectedAsset] = useState<"Ethereum" | "Starknet">(
    "Ethereum"
  );
  const [selectedRows, setSelectedRows] = useState<any[]>([]);

  const handleSelectedRowsChange = (rows: any[]) => {
    setSelectedRows(rows);
  };

  const swapAssets = () => {
    setSelectedAsset((prev) => (prev === "Ethereum" ? "Starknet" : "Ethereum"));
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
          realms={realms?.data.map((realm) => ({
            token_id: realm.token_id,
            name: realm.metadata?.name,
            attributes: realm.metadata?.attributes,
          }))}
          onSelectedRowsChange={handleSelectedRowsChange}
        />
      </SidebarInset>
      <Sidebar
        side="right"
        variant="inset"
        className="top-[--header-height] !h-[calc(100svh-var(--header-height))]"
      >
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
            <Button disabled={!selectedRows.length} className="w-full">
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
