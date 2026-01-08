import { useBlockTimestamp } from "@/shared/hooks/use-block-timestamp";
import { ArmyCapacity } from "@/shared/ui/army-capacity";
import { Badge } from "@/shared/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { ProgressCircle } from "@/shared/ui/progress-circle";
import { ResourceAmount } from "@/shared/ui/resource-amount";
import { ResourceIcon } from "@/shared/ui/resource-icon";
import {
  divideByPrecision,
  getAddressName,
  getArmyRelicEffects,
  getBlockTimestamp,
  getGuildFromPlayerAddress,
  getIsBlitz,
  getStructureName,
  ResourceManager,
  StaminaManager,
} from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { getExplorerFromToriiClient, getStructureFromToriiClient } from "@bibliothecadao/torii";
import {
  ContractAddress,
  ID,
  isRelic,
  RelicRecipientType,
  ResourcesIds,
  TroopTier,
  TroopType,
} from "@bibliothecadao/types";
import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { RelicActivationDrawer } from "../../relic-activation/ui/relic-activation-drawer";

// Utility function for formatting currency
const currencyFormat = (value: number, decimals: number = 0): string => {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
};

interface MobileArmyEntityDetailProps {
  armyEntityId: ID;
  compact?: boolean;
  maxInventory?: number;
}

const getTroopResourceId = (category: TroopType): number => {
  switch (category) {
    case TroopType.Knight:
      return ResourcesIds.Knight;
    case TroopType.Crossbowman:
      return ResourcesIds.Crossbowman;
    case TroopType.Paladin:
      return ResourcesIds.Paladin;
    default:
      return ResourcesIds.Knight;
  }
};

const getCharacterName = (tier: TroopTier, category: TroopType, entityId: ID): string => {
  return `${tier} ${category} #${entityId}`;
};

export const ArmyEntityDetail = ({
  armyEntityId,
  compact = false,
  maxInventory = Infinity,
}: MobileArmyEntityDetailProps) => {
  const {
    network: { toriiClient },
    account: { account },
    setup: { components },
  } = useDojo();

  const { currentArmiesTick, currentDefaultTick } = useBlockTimestamp();
  const userAddress = ContractAddress(account.address);

  const [relicDrawerOpen, setRelicDrawerOpen] = useState(false);
  const [selectedRelic, setSelectedRelic] = useState<{
    relicId: ID;
    relicBalance: number;
  } | null>(null);

  const { data: explorerData, isLoading: isLoadingExplorer } = useQuery({
    queryKey: ["explorer", String(armyEntityId)],
    queryFn: async () => {
      if (!toriiClient || !armyEntityId) return undefined;
      const explorer = await getExplorerFromToriiClient(toriiClient, armyEntityId);
      const relicEffects = explorer.explorer
        ? getArmyRelicEffects(explorer.explorer.troops, getBlockTimestamp().currentArmiesTick)
        : [];
      return { ...explorer, relicEffects };
    },
    staleTime: 30000,
  });

  const explorer = explorerData?.explorer;
  const explorerResources = explorerData?.resources;

  const { data: structureData, isLoading: isLoadingStructure } = useQuery({
    queryKey: ["structure", explorer?.owner ? String(explorer.owner) : "no-owner"],
    queryFn: async () => {
      if (!toriiClient || !explorer?.owner) return undefined;
      return getStructureFromToriiClient(toriiClient, explorer.owner);
    },
    enabled: !!toriiClient && !!explorer?.owner,
    staleTime: 30000,
  });

  const structure = structureData?.structure;

  const derivedData = useMemo(() => {
    if (!explorer) return undefined;

    const stamina = StaminaManager.getStamina(explorer.troops, currentArmiesTick);
    const maxStamina = StaminaManager.getMaxStamina(
      explorer.troops.category as TroopType,
      explorer.troops.tier as TroopTier,
    );

    const guild = structure ? getGuildFromPlayerAddress(ContractAddress(structure.owner), components) : undefined;
    const userGuild = getGuildFromPlayerAddress(userAddress, components);
    const isMine = structure?.owner === userAddress;
    const isAlly = isMine || (guild && userGuild && guild.entityId === userGuild.entityId) || false;

    const addressName = structure?.owner
      ? getAddressName(structure?.owner, components)
      : getCharacterName(explorer.troops.tier as TroopTier, explorer.troops.category as TroopType, armyEntityId);

    const structureOwnerName = structure ? getStructureName(structure, getIsBlitz()).name : undefined;

    return {
      stamina,
      maxStamina,
      playerGuild: guild,
      isAlly,
      isMine,
      addressName,
      structureOwnerName,
    };
  }, [explorer, structure, components, userAddress, armyEntityId, currentArmiesTick]);

  const staminaPercentage = useMemo(() => {
    if (!derivedData?.maxStamina || !derivedData?.stamina?.amount) return 0;
    return Math.round((Number(derivedData.stamina.amount) / Number(derivedData.maxStamina)) * 100);
  }, [derivedData?.maxStamina, derivedData?.stamina?.amount]);

  const { regularResources, relics } = useMemo(() => {
    if (!explorerResources) return { regularResources: [], relics: [] };

    const balances = ResourceManager.getResourceBalancesWithProduction(explorerResources, currentDefaultTick).filter(
      (resource) => resource.amount > 0,
    );

    const regular: typeof balances = [];
    const relicList: typeof balances = [];

    balances.forEach((resource) => {
      if (isRelic(resource.resourceId)) {
        relicList.push(resource);
      } else {
        regular.push(resource);
      }
    });

    return {
      regularResources: regular.sort((a, b) => b.amount - a.amount),
      relics: relicList.sort((a, b) => b.amount - a.amount),
    };
  }, [explorerResources, currentDefaultTick]);

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

  return (
    <>
      <Card>
        <CardHeader className={compact ? "pb-2" : "pb-3"}>
          <div className="flex items-center justify-between">
            <div className="flex flex-col flex-1 min-w-0">
              <CardTitle className={compact ? "text-base" : "text-lg"}>{derivedData.addressName}</CardTitle>
              {derivedData.playerGuild && (
                <div className="text-xs text-muted-foreground">
                  {"< "}
                  {derivedData.playerGuild.name}
                  {" >"}
                </div>
              )}
              {derivedData.structureOwnerName && (
                <p className="text-xs text-muted-foreground italic">Owner: {derivedData.structureOwnerName}</p>
              )}
            </div>
            <Badge variant={derivedData.isAlly ? "default" : "secondary"}>
              {derivedData.isAlly ? "Ally" : "Enemy"}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className={`space-y-3 ${compact ? "pt-0" : ""}`}>
          {/* Army Composition */}
          <div className="flex items-center gap-3 p-2 bg-muted/20 rounded border">
            <ResourceIcon resourceId={getTroopResourceId(explorer.troops.category as TroopType)} size={32} />
            <div className="flex-1">
              <div className="font-medium text-sm">
                {currencyFormat(divideByPrecision(Number(explorer.troops.count)), 0)} {explorer.troops.category}
              </div>
              <div className="text-xs text-muted-foreground">{explorer.troops.tier}</div>
            </div>
          </div>

          {/* Stamina and Capacity */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="text-xs font-medium uppercase text-muted-foreground">Stamina</div>
              <div className="flex items-center gap-2">
                <ProgressCircle progress={staminaPercentage} size="sm" className="text-blue-500" />
                <div className="text-xs">
                  {currencyFormat(Number(derivedData.stamina?.amount || 0), 0)}/
                  {currencyFormat(Number(derivedData.maxStamina || 0), 0)}
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-xs font-medium uppercase text-muted-foreground">Capacity</div>
              <ArmyCapacity resource={explorerResources} />
            </div>
          </div>

          {/* Active Relic Effects */}
          {explorerData?.relicEffects && explorerData.relicEffects.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-medium uppercase text-muted-foreground">Active Relic Effects</div>
              <div className="flex flex-wrap gap-1">
                {explorerData.relicEffects.map((effect, index) => {
                  const timeRemaining = Math.max(0, Number(effect.endTick) - getBlockTimestamp().currentArmiesTick);
                  return (
                    <div
                      key={index}
                      className="flex items-center gap-1 px-2 py-1 bg-yellow-500/20 rounded text-xs border border-yellow-500/30"
                    >
                      <ResourceIcon resourceId={Number(effect.id)} size={16} />
                      <span className="text-yellow-700 dark:text-yellow-300">
                        {timeRemaining > 0 ? `${timeRemaining} ticks` : "Expired"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Resources */}
          {(regularResources.length > 0 || relics.length > 0) && (
            <div className="space-y-2">
              <div className="text-xs font-medium uppercase text-muted-foreground">Resources & Relics</div>
              <div className="grid grid-cols-4 gap-2 max-h-32 overflow-y-auto">
                {regularResources.slice(0, Math.min(maxInventory, compact ? 8 : 16)).map((resource) => {
                  const isRelicActive = explorerData?.relicEffects?.some(
                    (effect) => Number(effect.id) === resource.resourceId,
                  );
                  return (
                    <div
                      key={resource.resourceId}
                      className={`relative flex flex-col items-center gap-1 p-1 rounded bg-muted/10 ${
                        isRelicActive ? "bg-purple-500/20 border border-purple-500/50 animate-pulse" : ""
                      }`}
                    >
                      <ResourceIcon resourceId={resource.resourceId} size={20} />
                      <ResourceAmount
                        amount={divideByPrecision(Number(resource.amount))}
                        resourceId={resource.resourceId}
                        className="text-xxs"
                      />
                      {isRelicActive && (
                        <div className="absolute top-0 right-0 pointer-events-none">
                          <Sparkles className="h-2 w-2 text-purple-400 animate-pulse" />
                        </div>
                      )}
                    </div>
                  );
                })}
                {relics.map((relic) => {
                  const isRelicActive = explorerData?.relicEffects?.some(
                    (effect) => Number(effect.id) === relic.resourceId,
                  );
                  return (
                    <div
                      key={relic.resourceId}
                      className={`relative flex flex-col items-center gap-1 p-1 rounded cursor-pointer hover:opacity-80 transition-opacity ${
                        isRelicActive
                          ? "bg-purple-500/20 border border-purple-500/50 animate-pulse"
                          : "bg-yellow-500/10 border border-yellow-500/30"
                      }`}
                      onClick={() => {
                        setSelectedRelic({
                          relicId: relic.resourceId,
                          relicBalance: divideByPrecision(Number(relic.amount)),
                        });
                        setRelicDrawerOpen(true);
                      }}
                    >
                      <ResourceAmount
                        amount={divideByPrecision(Number(relic.amount))}
                        resourceId={relic.resourceId}
                        className="text-xxs"
                        showName={false}
                      />
                      {isRelicActive && (
                        <div className="absolute top-0 right-0 pointer-events-none">
                          <Sparkles className="h-2 w-2 text-purple-400 animate-pulse" />
                        </div>
                      )}
                    </div>
                  );
                })}
                {regularResources.length + relics.length > Math.min(maxInventory, compact ? 8 : 16) && (
                  <div className="flex items-center justify-center p-1 text-xs text-muted-foreground">
                    +{regularResources.length + relics.length - Math.min(maxInventory, compact ? 8 : 16)} more
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedRelic && (
        <RelicActivationDrawer
          entityId={armyEntityId}
          entityOwnerId={explorer.owner || armyEntityId}
          recipientType={RelicRecipientType.Explorer}
          relicId={selectedRelic.relicId}
          relicBalance={selectedRelic.relicBalance}
          open={relicDrawerOpen}
          onOpenChange={(open) => {
            setRelicDrawerOpen(open);
            if (!open) {
              setSelectedRelic(null);
            }
          }}
        />
      )}
    </>
  );
};
