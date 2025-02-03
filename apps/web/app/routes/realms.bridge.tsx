import { BridgeTable, columns } from "@/components/modules/realms/bridge-table";
import { Button } from "@/components/ui/button";
import { createFileRoute } from "@tanstack/react-router";
import { Suspense, useEffect, useMemo, useState } from "react";
import EthereumIcon from "@/components/icons/ethereum.svg";
import StarknetIcon from "@/components/icons/starknet.svg";
import { ArrowLeftRight } from "lucide-react";
import {
  SidebarInset,
  SidebarProvider,
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
import { useAccount as useL1Account } from "wagmi";
import { trpc } from "@/router";

import BridgeSidebar from "@/components/modules/realms/bridge-sidebar";
import { getCoreRowModel, getPaginationRowModel, RowSelectionState, useReactTable } from "@tanstack/react-table";

export const Route = createFileRoute("/realms/bridge")({
  component: RouteComponent,
});

function RouteComponent() {
  const { address: l1Address } = useL1Account();
  const { address: l2Address } = useAccount();


  const l1RealmsQuery = trpc.l1Realms.useQuery({address: l1Address});
  const l1Realms = l1RealmsQuery.data || []
  console.log(l1Realms)

  const arkClient = marketPlaceClientBuilder(window.fetch.bind(window));
  const { data: realms } = useSuspenseQuery(
    realmsQueryOptions({
      walletAddress: l2Address ?? "",
      client: arkClient,
      collectionAddress: CollectionAddresses.realms[ChainId.SN_MAIN] as string,
    })
  );

  const [selectedAsset, setSelectedAsset] = useState<"Ethereum" | "Starknet">(
    "Ethereum"
  );

  const mappedRealms = useMemo(() => {
    if (selectedAsset === "Ethereum") {
      console.log(l1Realms)
      return (
        l1Realms?.tokens?.map((realm) => ({
          token_id: realm.token.tokenId,
          name: realm.token?.name,
          attributes: realm.token?.attributes.map((attribute) => ({
            ...attribute,
            trait_type: attribute.key,
          })),
        })) ?? []
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

  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const table = useReactTable({
    data: mappedRealms ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onRowSelectionChange: setRowSelection,
    state: {
      rowSelection,
    },
  });

  useEffect(() => {
    setRowSelection({})
  }, [selectedAsset])


  const swapAssets = () => {
    setSelectedAsset((prev) => (prev === "Ethereum" ? "Starknet" : "Ethereum"));
  };

  const selectedRows = table.getFilteredSelectedRowModel().rows;


  return (
    <SidebarProvider
      style={{
        "--sidebar-width": "32rem",
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
        <Suspense fallback={<div>Loading...</div>}>
          <BridgeTable
            table={table}
          />
        </Suspense>
      </SidebarInset>
      <BridgeSidebar
        selectedRows={selectedRows}
        selectedAsset={selectedAsset}
      />
    </SidebarProvider>
  );
}
