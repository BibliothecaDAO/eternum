import { Badge } from "@/shared/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { ResourceIcon } from "@/shared/ui/resource-icon";
import {
  getAddressName,
  getBlockTimestamp,
  getIsBlitz,
  getStructureName,
  StaminaManager,
} from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { getExplorerFromToriiClient, getStructureFromToriiClient } from "@bibliothecadao/torii";
import { ContractAddress, ID, TroopTier, TroopType } from "@bibliothecadao/types";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

interface MobileArmyEntityDetailProps {
  armyEntityId: ID;
  compact?: boolean;
}

const getTroopResourceId = (category: TroopType): number => {
  switch (category) {
    case TroopType.Knight:
      return 26;
    case TroopType.Crossbowman:
      return 29;
    case TroopType.Paladin:
      return 32;
    default:
      return 26;
  }
};

const getCharacterName = (tier: TroopTier, category: TroopType, entityId: ID): string => {
  return `${tier} ${category} #${entityId}`;
};

export const ArmyEntityDetail = ({ armyEntityId, compact = false }: MobileArmyEntityDetailProps) => {
  const {
    network: { toriiClient },
    account: { account },
    setup: { components },
  } = useDojo();

  const userAddress = ContractAddress(account.address);

  const { data: explorerData, isLoading: isLoadingExplorer } = useQuery({
    queryKey: ["explorer", String(armyEntityId)],
    queryFn: async () => {
      if (!toriiClient || !armyEntityId) return undefined;
      return getExplorerFromToriiClient(toriiClient, armyEntityId);
    },
    staleTime: 30000,
  });

  const explorer = explorerData?.explorer;
  const explorerResources = explorerData?.resources;

  const { data: structureData, isLoading: isLoadingStructure } = useQuery({
    queryKey: ["structure", explorer?.owner ? String(explorer.owner) : undefined],
    queryFn: async () => {
      if (!toriiClient || !explorer?.owner) return undefined;
      return getStructureFromToriiClient(toriiClient, explorer.owner);
    },
    enabled: !!explorer?.owner,
    staleTime: 30000,
  });

  const structure = structureData?.structure;

  const derivedData = useMemo(() => {
    if (!explorer) return undefined;

    const { currentArmiesTick } = getBlockTimestamp();

    const stamina = StaminaManager.getStamina(explorer.troops, currentArmiesTick);
    const maxStamina = StaminaManager.getMaxStamina(
      explorer.troops.category as TroopType,
      explorer.troops.tier as TroopTier,
    );

    const isMine = structure?.owner === userAddress;
    const addressName = structure?.owner
      ? getAddressName(structure?.owner, components)
      : getCharacterName(explorer.troops.tier as TroopTier, explorer.troops.category as TroopType, armyEntityId);

    const structureOwnerName = structure ? getStructureName(structure, getIsBlitz()).name : undefined;

    return {
      stamina,
      maxStamina,
      isMine,
      addressName,
      structureOwnerName,
    };
  }, [explorer, structure, components, userAddress, armyEntityId]);

  if (isLoadingExplorer || (explorer?.owner && isLoadingStructure)) {
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

  if (!explorer || !derivedData) return null;

  const staminaPercentage =
    derivedData.maxStamina > 0 ? Math.round((Number(derivedData.stamina) / Number(derivedData.maxStamina)) * 100) : 0;

  const resourceCount = explorerResources
    ? Object.keys(explorerResources).filter(
        (key) => key.endsWith("_BALANCE") && Number(explorerResources[key as keyof typeof explorerResources]) > 0,
      ).length
    : 0;

  return (
    <Card>
      <CardHeader className={compact ? "pb-2" : "pb-3"}>
        <div className="flex items-center justify-between">
          <CardTitle className={compact ? "text-base" : "text-lg"}>{derivedData.addressName}</CardTitle>
          <Badge variant={derivedData.isMine ? "default" : "secondary"}>{derivedData.isMine ? "Mine" : "Enemy"}</Badge>
        </div>
        {derivedData.structureOwnerName && (
          <p className="text-sm text-muted-foreground">Owner: {derivedData.structureOwnerName}</p>
        )}
      </CardHeader>

      <CardContent className={`space-y-3 ${compact ? "pt-0" : ""}`}>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <ResourceIcon resourceId={getTroopResourceId(explorer.troops.category as TroopType)} size={24} />
            <div className="text-sm">
              <div className="font-medium">{Number(explorer.troops.count)} troops</div>
              <div className="text-muted-foreground">Tier {Number(explorer.troops.tier)}</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="font-medium">Stamina</div>
            <div className="text-muted-foreground">
              {Number(derivedData.stamina)}/{Number(derivedData.maxStamina)} ({staminaPercentage}%)
            </div>
          </div>

          <div>
            <div className="font-medium">Resources</div>
            <div className="text-muted-foreground">{resourceCount} items</div>
          </div>
        </div>

        {explorerResources && resourceCount > 0 && (
          <div className="text-xs text-muted-foreground">Resources available (detailed view coming soon)</div>
        )}
      </CardContent>
    </Card>
  );
};
