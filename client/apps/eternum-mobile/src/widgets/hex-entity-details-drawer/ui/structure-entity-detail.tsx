import { Badge } from "@/shared/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { getAddressName, getIsBlitz, getStructureName, getStructureTypeName } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { getStructureFromToriiClient } from "@bibliothecadao/torii";
import { ContractAddress, ID, StructureType } from "@bibliothecadao/types";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

interface MobileStructureEntityDetailProps {
  structureEntityId: ID;
  compact?: boolean;
}

export const StructureEntityDetail = ({ structureEntityId, compact = false }: MobileStructureEntityDetailProps) => {
  const {
    network: { toriiClient },
    account: { account },
    setup: { components },
  } = useDojo();

  const userAddress = ContractAddress(account.address);

  const { data: structureData, isLoading } = useQuery({
    queryKey: ["structure", String(structureEntityId)],
    queryFn: async () => {
      if (!toriiClient || !structureEntityId) return undefined;
      return getStructureFromToriiClient(toriiClient, structureEntityId);
    },
    staleTime: 30000,
  });

  const structure = structureData?.structure;
  const structureResources = structureData?.resources;

  const derivedData = useMemo(() => {
    if (!structure) return undefined;

    const isMine = structure.owner === userAddress;
    const ownerName = getAddressName(structure.owner, components);
    const structureInfo = getStructureName(structure, getIsBlitz());

    return {
      isMine,
      ownerName,
      structureName: structureInfo.name,
      structureType: structure.category as StructureType,
    };
  }, [structure, components, userAddress]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!structure || !derivedData) return null;

  const resourceCount = structureResources
    ? Object.keys(structureResources).filter(
        (key) => key.endsWith("_BALANCE") && Number(structureResources[key as keyof typeof structureResources]) > 0,
      ).length
    : 0;

  const isBlitz = getIsBlitz();

  return (
    <Card>
      <CardHeader className={compact ? "pb-2" : "pb-3"}>
        <div className="flex items-center justify-between">
          <CardTitle className={compact ? "text-base" : "text-lg"}>{derivedData.structureName}</CardTitle>
          <Badge variant={derivedData.isMine ? "default" : "secondary"}>{derivedData.isMine ? "Mine" : "Enemy"}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {getStructureTypeName(derivedData.structureType, isBlitz)}
          </span>
        </div>
        {derivedData.ownerName && <p className="text-sm text-muted-foreground">Owner: {derivedData.ownerName}</p>}
      </CardHeader>

      <CardContent className={`space-y-3 ${compact ? "pt-0" : ""}`}>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="font-medium">Entity ID</div>
            <div className="text-muted-foreground">#{structureEntityId}</div>
          </div>

          <div>
            <div className="font-medium">Resources</div>
            <div className="text-muted-foreground">{resourceCount} items</div>
          </div>
        </div>

        {structureResources && resourceCount > 0 && (
          <div>
            <div className="text-sm font-medium mb-2">Inventory</div>
            <div className="text-xs text-muted-foreground">Resources available (detailed view coming soon)</div>
          </div>
        )}

        {derivedData.structureType === StructureType.Hyperstructure && (
          <div className="bg-muted/50 rounded p-2">
            <div className="text-sm font-medium">Hyperstructure</div>
            <div className="text-xs text-muted-foreground">Special structure for advanced gameplay</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
