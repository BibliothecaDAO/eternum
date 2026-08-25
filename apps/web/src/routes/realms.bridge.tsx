import type { BridgeRealm, TokenMetadataAttribute } from "@/types/ark";
import type { RowSelectionState } from "@tanstack/react-table";
import { Suspense, useEffect, useMemo, useState } from "react";
import EthereumIcon from "@/components/icons/ethereum.svg?react";
import StarknetIcon from "@/components/icons/starknet.svg?react";
import { PageHeader } from "@/components/layout/page-header";
import BridgeSidebar from "@/components/modules/realms/bridge-sidebar";
import { BridgeTable } from "@/components/modules/realms/bridge-table";
import { OwnershipStatusAlert } from "@/components/modules/realms/ownership-status-alert";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useStarknetWallet } from "@/hooks/use-starknet-wallet";
import { getL1RealmsQueryOptions } from "@/lib/getL1Realms";
import { getRealmInventoryQueryOptions } from "@/lib/realms/get-realm-inventory";
import {
  getRealmInventoryViewState,
  parseRealmTokenId,
} from "@/lib/realms/inventory-ui";
import { useAccount } from "@starknet-start/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useReactTable } from "@tanstack/react-table";
import { ArrowLeftRight, TriangleAlert } from "lucide-react";
import { useAccount as useL1Account } from "wagmi";

import {
  getRealmBridgeTableOptions,
  reconcileRealmBridgeSelection,
} from "./-realms.bridge-table";

export const Route = createFileRoute("/realms/bridge")({
  component: RouteComponent,
});

interface L1MetadataAttribute extends TokenMetadataAttribute {
  key?: string;
}

function isMetadataAttribute(value: unknown): value is L1MetadataAttribute {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseRealmMetadata(
  metadata: string | undefined,
): Pick<BridgeRealm, "name" | "attributes"> {
  if (!metadata) return {};

  try {
    const parsed: unknown = JSON.parse(metadata);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return {};
    }
    const fields = parsed as Record<string, unknown>;
    return {
      name: typeof fields.name === "string" ? fields.name : undefined,
      attributes: Array.isArray(fields.attributes)
        ? fields.attributes.filter(isMetadataAttribute)
        : undefined,
    };
  } catch {
    return {};
  }
}

function RouteComponent() {
  const { address: l1Address } = useL1Account();
  const { address: l2Address } = useAccount();

  const l1RealmsQuery = useQuery(
    getL1RealmsQueryOptions({ address: l1Address }),
  );
  const l1Realms = l1RealmsQuery.data;
  const l2RealmsQuery = useQuery(
    getRealmInventoryQueryOptions({
      address: l2Address,
    }),
  );
  const l2Inventory = l2RealmsQuery.data;
  const l2Realms = l2Inventory?.tokens;
  const l2InventoryViewState = getRealmInventoryViewState({
    isPending: l2RealmsQuery.isPending,
    isError: l2RealmsQuery.isError,
    status: l2Inventory?.status,
  });

  const [selectedAsset, setSelectedAsset] = useState<"Ethereum" | "Starknet">(
    "Ethereum",
  );

  const mappedRealms = useMemo(() => {
    if (selectedAsset === "Ethereum") {
      return (
        l1Realms?.tokens?.flatMap((realm) => {
          const tokenId = parseRealmTokenId(realm.token?.tokenId);
          if (tokenId === undefined) return [];

          return [
            {
              token_id: tokenId,
              name: realm.token?.name,
              attributes:
                realm.token?.attributes
                  ?.filter(isMetadataAttribute)
                  .map((attribute) => ({
                    ...attribute,
                    trait_type: attribute.key ?? attribute.trait_type,
                  })) ?? [],
            },
          ];
        }) ?? []
      );
    } else if (selectedAsset === "Starknet") {
      return (
        l2Realms?.map((realm) => {
          const { attributes, name } = parseRealmMetadata(realm.metadata);
          return {
            token_id: realm.token_id,
            name,
            attributes,
          };
        }) ?? []
      );
    }
    return [];
  }, [selectedAsset, l2Realms, l1Realms]);

  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const table = useReactTable(
    getRealmBridgeTableOptions({
      data: mappedRealms,
      onRowSelectionChange: setRowSelection,
      rowSelection,
    }),
  );

  const starknetInventoryReady =
    !!l2Address && l2InventoryViewState === "ready";

  useEffect(() => {
    setRowSelection({});
  }, [selectedAsset, l1Address, l2Address, starknetInventoryReady]);

  useEffect(() => {
    setRowSelection((current) =>
      reconcileRealmBridgeSelection(current, mappedRealms),
    );
  }, [mappedRealms]);

  const swapAssets = () => {
    setSelectedAsset((prev) => (prev === "Ethereum" ? "Starknet" : "Ethereum"));
  };
  //const { openConnectModal } = useConnectModal();
  const { openStarknetKitModal } = useStarknetWallet();

  const selectedRows = table.getFilteredSelectedRowModel().rows;
  const canShowInventory =
    selectedAsset !== "Starknet" || starknetInventoryReady;
  const bridgeDisabled = selectedAsset === "Starknet" && !canShowInventory;

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
        <PageHeader eyebrow="Realms" title="Starknet Bridge" className="mt-6" />
        <div className="mb-6 flex items-center justify-center gap-3">
          <div className="realm-subtle-panel flex items-center gap-2 rounded-lg px-4 py-2.5">
            <span className="text-muted-foreground text-sm">From</span>
            {selectedAsset === "Ethereum" ? (
              <>
                <EthereumIcon className="h-5 w-5" />
                <span className="font-semibold">Ethereum</span>
              </>
            ) : (
              <>
                <StarknetIcon className="h-5 w-5" />
                <span className="font-semibold">Starknet</span>
              </>
            )}
          </div>
          <Button
            size="icon"
            variant="outline"
            onClick={swapAssets}
            className="rounded-full"
          >
            <ArrowLeftRight className="h-4 w-4" />
          </Button>
          <div className="realm-subtle-panel flex items-center gap-2 rounded-lg px-4 py-2.5">
            <span className="text-muted-foreground text-sm">To</span>
            {selectedAsset === "Ethereum" ? (
              <>
                <StarknetIcon className="h-5 w-5" />
                <span className="font-semibold">Starknet</span>
              </>
            ) : (
              <>
                <EthereumIcon className="h-5 w-5" />
                <span className="font-semibold">Ethereum</span>
              </>
            )}
          </div>
        </div>
        {selectedAsset === "Ethereum" && !l1Address && (
          <Alert variant="warning" className="mb-4 rounded">
            <TriangleAlert className="h-5 w-5" />
            <AlertTitle className="text-lg">
              Your Ethereum wallet is not connected
            </AlertTitle>
            <AlertDescription>
              Connect your Ethereum wallet using the sidebar to view and bridge
              your Realms
            </AlertDescription>
          </Alert>
        )}
        {selectedAsset === "Starknet" && !l2Address && (
          <Alert variant="warning" className="mb-4 rounded">
            <TriangleAlert className="h-5 w-5" />
            <AlertTitle className="text-lg">
              Your Starknet wallet is not connected
            </AlertTitle>
            <AlertDescription>
              <Button
                className="h-auto p-0"
                variant="link"
                onClick={() => openStarknetKitModal()}
              >
                Connect your Starknet wallet
              </Button>{" "}
              to view and bridge your Realms
            </AlertDescription>
          </Alert>
        )}
        {selectedAsset === "Starknet" &&
          l2Address &&
          (l2InventoryViewState === "loading" ? (
            <div className="mb-4">Loading Realm inventory...</div>
          ) : (
            <OwnershipStatusAlert
              className="mb-4"
              status={l2Inventory?.status}
              isError={l2InventoryViewState === "error"}
              onRetry={() => void l2RealmsQuery.refetch()}
            />
          ))}
        {canShowInventory && (
          <Suspense fallback={<div>Loading...</div>}>
            <BridgeTable table={table} />
          </Suspense>
        )}
      </SidebarInset>
      <BridgeSidebar
        disabled={bridgeDisabled}
        selectedRows={bridgeDisabled ? [] : selectedRows}
        setRowSelection={setRowSelection}
        selectedAsset={selectedAsset}
      />
    </SidebarProvider>
  );
}
