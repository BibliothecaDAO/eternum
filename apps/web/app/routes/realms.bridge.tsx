import type { RowSelectionState } from "@tanstack/react-table";
import { Suspense, useEffect, useMemo, useState } from "react";
import EthereumIcon from "@/components/icons/ethereum.svg?react";
import StarknetIcon from "@/components/icons/starknet.svg?react";
import BridgeSidebar from "@/components/modules/realms/bridge-sidebar";
import { BridgeTable, columns } from "@/components/modules/realms/bridge-table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useStarknetWallet } from "@/hooks/use-starknet-wallet";
import { trpc } from "@/router";
import { SUPPORTED_L2_CHAIN_ID } from "@/utils/utils";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useAccount } from "@starknet-react/core";
import { createFileRoute } from "@tanstack/react-router";
import {
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowLeftRight, TriangleAlert } from "lucide-react";
import { useAccount as useL1Account } from "wagmi";

import { CollectionAddresses } from "@realms-world/constants";

export const Route = createFileRoute("/realms/bridge")({
  component: RouteComponent,
});

function RouteComponent() {
  const { address: l1Address } = useL1Account();
  const { address: l2Address } = useAccount();

  const l1RealmsQuery = trpc.l1Realms.useQuery(
    { address: l1Address },
    { refetchInterval: 10000, enabled: !!l1Address },
  );
  const l1Realms = l1RealmsQuery.data;

  const l2RealmsQuery = trpc.realms.useQuery(
    {
      address: l2Address,
      collectionAddress: CollectionAddresses.realms[
        SUPPORTED_L2_CHAIN_ID
      ] as string,
    },
    { refetchInterval: 10000, enabled: !!l2Address },
  );
  const l2Realms = l2RealmsQuery.data;

  const [selectedAsset, setSelectedAsset] = useState<"Ethereum" | "Starknet">(
    "Ethereum",
  );

  const mappedRealms = useMemo(() => {
    if (selectedAsset === "Ethereum" && l1Realms) {
      return (
        l1Realms.tokens?.map((realm) => ({
          token_id: realm.token?.tokenId,
          name: realm.token?.name,
          attributes:
            realm.token?.attributes?.map((attribute) => ({
              ...attribute,
              trait_type: attribute.key,
            })) ?? [],
        })) ?? []
      );
    } else if (selectedAsset === "Starknet" && l2Realms) {
      return l2Realms.data.map((realm) => ({
        token_id: realm.token_id,
        name: realm.metadata?.name,
        attributes: realm.metadata?.attributes,
      }));
    } else {
      return [];
    }
  }, [selectedAsset, l2Realms, l1Realms]);

  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const table = useReactTable({
    data: mappedRealms,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onRowSelectionChange: setRowSelection,
    state: {
      rowSelection,
    },
  });

  useEffect(() => {
    setRowSelection({});
  }, [selectedAsset]);

  const swapAssets = () => {
    setSelectedAsset((prev) => (prev === "Ethereum" ? "Starknet" : "Ethereum"));
  };
  const { openConnectModal } = useConnectModal();
  const { openStarknetKitModal } = useStarknetWallet();

  const selectedRows = table.getFilteredSelectedRowModel().rows;

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "32rem",
          "--sidebar-width-mobile": "26rem",
        } as React.CSSProperties
      }
      className="flex flex-1"
    >
      <SidebarInset className="px-6">
        <div className="my-8 flex items-center justify-center space-x-4">
          <Button
            size="lg"
            className={`bg-primary/80 hover:bg-primary/80 cursor-default rounded-full`}
          >
            From:
            {selectedAsset === "Ethereum" ? (
              <>
                <EthereumIcon className="w-6! h-6!" />
                Ethereum
              </>
            ) : (
              <>
                <StarknetIcon className="w-6! h-6!" />
                Starknet
              </>
            )}
          </Button>
          <Button size="icon" onClick={swapAssets} className="rounded">
            <ArrowLeftRight className="h-7 w-7" />
          </Button>
          <Button size="lg" className="rounded-full" onClick={swapAssets}>
            To:
            {selectedAsset === "Ethereum" ? (
              <>
                <StarknetIcon className="w-6! h-6!" />
                Starknet
              </>
            ) : (
              <>
                <EthereumIcon className="w-6! h-6!" />
                Ethereum
              </>
            )}
          </Button>
        </div>
        {selectedAsset === "Ethereum" && !l1Address && (
          <Alert className="mb-4 rounded border-yellow-600">
            <TriangleAlert className="h-5 w-5" />
            <AlertTitle className="text-lg">
              Your Ethereum wallet is not connected
            </AlertTitle>
            <AlertDescription>
              <Button
                className="pl-0 pr-2"
                variant={"link"}
                onClick={openConnectModal}
              >
                Connect
              </Button>
              to view and bridge your Realms
            </AlertDescription>
          </Alert>
        )}
        {selectedAsset === "Starknet" && !l2Address && (
          <Alert className="mb-4 rounded border-yellow-600">
            <TriangleAlert className="h-5 w-5" />
            <AlertTitle className="text-lg">
              Your Starknet wallet is not connected
            </AlertTitle>
            <AlertDescription>
              <Button
                className="pl-0 pr-2"
                variant={"link"}
                onClick={() => openStarknetKitModal()}
              >
                Connect
              </Button>
              to view and bridge your Realms
            </AlertDescription>
          </Alert>
        )}
        <Suspense fallback={<div>Loading...</div>}>
          <BridgeTable table={table} />
        </Suspense>
      </SidebarInset>
      <BridgeSidebar
        selectedRows={selectedRows}
        setRowSelection={setRowSelection}
        selectedAsset={selectedAsset}
      />
    </SidebarProvider>
  );
}
