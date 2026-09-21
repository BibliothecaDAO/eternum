import {
  AlertCircle as AlertCircleIcon,
  ArrowUpRight as ArrowUpRightIcon,
  ChevronDown as ChevronDownIcon,
  Crown as CrownIcon,
  Plus as PlusIcon,
  Pickaxe,
} from "@/ui/design-system/atoms/game-icons";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { surfaceAnchorFrom } from "@/ui/design-system/molecules/popover";
import { usePopoverStore } from "@/hooks/store/use-popover-store";
import Button from "@/ui/design-system/atoms/button";
import { ResourceCost } from "@/ui/design-system/molecules/resource-cost";
import { ProductionModal } from "@/ui/features/settlement";
import { useBlitzRealmProvision } from "@/ui/modules/entity-details/hooks/use-blitz-realm-provision";
import { useRealmUpgradeAndProvision } from "@/ui/modules/entity-details/hooks/use-realm-upgrade-and-provision";
import { resolveRealmBootstrapErrorMessage } from "@/ui/modules/entity-details/hooks/realm-bootstrap-error";
import { configManager } from "@bibliothecadao/eternum";
import { useGame, useNativeRow } from "@bibliothecadao/react";
import { ContractAddress, LEVEL_DESCRIPTIONS, RealmLevels, ResourcesIds } from "@bibliothecadao/types";
import { useState } from "react";
import { useStructureUpgrade } from "@/ui/modules/entity-details/hooks/use-structure-upgrade";

export const Castle = () => {
  const game = useGame();
  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const openSurface = usePopoverStore((state) => state.openSurface);
  const [showMissingResources, setShowMissingResources] = useState(false);
  const structure = useNativeRow("Structure", {
    game_id: configManager.getActiveGameId(),
    entity_id: structureEntityId,
  });
  const upgrade = useStructureUpgrade(structureEntityId);
  const getNextRealmLevel = upgrade?.nextLevel;
  const checkBalance = upgrade?.canUpgrade ?? false;
  const missingResources = upgrade?.missingRequirements ?? [];
  const isLevelUpLoading = upgrade?.isUpgradeLoading ?? false;
  const levelUpRealm = upgrade?.handleUpgrade;
  const isLaborProductionEnabled = configManager.isLaborProductionEnabled();

  const provisionInfo = useBlitzRealmProvision(structureEntityId ?? null);
  const bootstrapInfo = useRealmUpgradeAndProvision(structureEntityId ?? null);
  const isBootstrapMode = Boolean(provisionInfo?.needsBootstrap);

  const bootstrapRealm = async () => {
    try {
      await bootstrapInfo.handleUpgradeAndProvision();
    } catch (error) {
      console.warn("realm_bootstrap_failed", { message: resolveRealmBootstrapErrorMessage(error) });
    }
  };

  if (!structure) return null;
  const isOwner = structure.owner === ContractAddress(game.account.account.address);

  return (
    structure && (
      <div className="castle-selector w-full text-sm">
        <div className="space-y-2">
          {/* Realm Level Section */}
          <div className="bg-gold/5 border border-gold/20 rounded-lg p-4">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="bg-gold/10 p-2 rounded-lg">
                  <CrownIcon className="w-6 h-6 text-gold" />
                </div>
                <h5 className="text-2xl font-bold text-gold">{RealmLevels[structure.base.level]}</h5>
              </div>

              {getNextRealmLevel && isOwner && (
                <Button
                  variant={(isBootstrapMode ? bootstrapInfo.canProvision : checkBalance) ? "gold" : "outline"}
                  disabled={isBootstrapMode ? !bootstrapInfo.canProvision : !checkBalance}
                  isLoading={isBootstrapMode ? bootstrapInfo.isPending : isLevelUpLoading}
                  onClick={isBootstrapMode ? bootstrapRealm : levelUpRealm}
                  className="w-full"
                >
                  {isBootstrapMode
                    ? "Bootstrap Realm"
                    : checkBalance
                      ? `Upgrade to ${RealmLevels[getNextRealmLevel]}`
                      : "Need Resources"}
                  {isBootstrapMode ? (
                    <Pickaxe className="w-4 h-4 ml-2" />
                  ) : (
                    <ArrowUpRightIcon className="w-4 h-4 ml-2" />
                  )}
                </Button>
              )}
            </div>

            {/* Upgrade Requirements Section */}
            {getNextRealmLevel && isOwner && (
              <div className="bg-gold/5 border border-gold/10 rounded-lg px-4 py-4 space-y-3">
                <div>
                  <h6 className="text-gold font-semibold mb-2">
                    Upgrade Requirements for {RealmLevels[getNextRealmLevel]}
                  </h6>
                  <p className="text-gold/90 mb-4 text-sm">
                    {LEVEL_DESCRIPTIONS[getNextRealmLevel as keyof typeof LEVEL_DESCRIPTIONS]}
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {configManager.realmUpgradeCosts[getNextRealmLevel]?.map((a: any) => (
                      <ResourceCost
                        key={a.resource}
                        type="vertical"
                        size="lg"
                        resourceId={a.resource}
                        amount={a.amount}
                      />
                    ))}
                  </div>

                  {/* Missing Resources Section */}
                  {!checkBalance && missingResources.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gold/10">
                      <button
                        onClick={() => setShowMissingResources(!showMissingResources)}
                        className="flex items-center justify-between w-full text-left group"
                      >
                        <div className="flex items-center gap-2">
                          <AlertCircleIcon className="w-4 h-4 text-amber-400" />
                          <h6 className="text-amber-400 font-semibold">Missing Resources</h6>
                        </div>
                        <ChevronDownIcon
                          className={`w-4 h-4 text-amber-400 transition-transform ${showMissingResources ? "rotate-180" : ""}`}
                        />
                      </button>

                      {showMissingResources && (
                        <>
                          <div className="flex flex-wrap gap-3 mt-3">
                            {missingResources.map((resource) => (
                              <div key={resource.resource} className="relative">
                                <ResourceCost
                                  type="vertical"
                                  size="md"
                                  resourceId={resource.resource}
                                  amount={resource.amount}
                                  className="opacity-80"
                                />
                              </div>
                            ))}
                          </div>
                          <Button
                            onClick={(event) =>
                              openSurface({
                                id: "production",
                                content: <ProductionModal />,
                                anchor: surfaceAnchorFrom(event.currentTarget),
                              })
                            }
                            variant="outline"
                            size="md"
                            className="mt-3 w-full border-amber-400/30 text-amber-400 hover:bg-amber-400/10"
                          >
                            <div className="flex items-center justify-center gap-2">
                              <PlusIcon className="w-3 h-3" />
                              Produce Resources
                            </div>
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Labor Production Button */}
          {isOwner && isLaborProductionEnabled && (
            <div className="flex justify-center">
              <Button
                onClick={(event) =>
                  openSurface({
                    id: "production",
                    content: <ProductionModal preSelectedResource={ResourcesIds.Labor} />,
                    anchor: surfaceAnchorFrom(event.currentTarget),
                  })
                }
                variant="primary"
                withoutSound
                className="w-full max-w-[300px]"
              >
                <div className="flex items-center justify-center gap-2">
                  <PlusIcon className="w-4 h-4" />
                  Produce Labor
                </div>
              </Button>
            </div>
          )}
        </div>
      </div>
    )
  );
};
