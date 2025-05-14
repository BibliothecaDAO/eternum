import { useUIStore } from "@/hooks/store/use-ui-store";
import { ProductionModal } from "@/ui/components/production/production-modal";
import { RealmResourcesIO } from "@/ui/components/resources/realm-resources-io";
import Button from "@/ui/elements/button";
import { ResourceCost } from "@/ui/elements/resource-cost";
import {
  configManager,
  divideByPrecision,
  getBalance,
  getEntityIdFromKeys,
  unpackValue,
} from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import {
  ContractAddress,
  ID,
  LEVEL_DESCRIPTIONS,
  RealmLevels,
  ResourcesIds,
  StructureType,
} from "@bibliothecadao/types";
import { useEffect, useMemo, useState } from "react";
// todo: fix this
import { getBlockTimestamp } from "@/utils/timestamp";
import { getSurroundingWonderBonusFromToriiClient } from "@bibliothecadao/torii-client";
import { useComponentValue } from "@dojoengine/react";
import { ArrowUpRightIcon, CrownIcon, PlusIcon, SparklesIcon } from "lucide-react";

const WONDER_BONUS_DISTANCE = 12;

export const Castle = () => {
  const dojo = useDojo();
  const currentDefaultTick = getBlockTimestamp().currentDefaultTick;
  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const toggleModal = useUIStore((state) => state.toggleModal);
  const [isWonderBonusLoading, setIsWonderBonusLoading] = useState(false);
  const [isLevelUpLoading, setIsLevelUpLoading] = useState(false);
  const [wonderStructureId, setWonderStructureId] = useState<ID | null>(null);

  const productionWonderBonus = useComponentValue(
    dojo.setup.components.ProductionWonderBonus,
    getEntityIdFromKeys([BigInt(structureEntityId)]),
  );
  const hasActivatedWonderBonus = !!productionWonderBonus;

  const onActivateWonderBonus = async () => {
    setIsWonderBonusLoading(true);
    if (!wonderStructureId) return;

    try {
      await dojo.setup.systemCalls.claim_wonder_production_bonus({
        signer: dojo.account.account,
        wonder_structure_id: wonderStructureId,
        structure_id: structureEntityId,
      });
      setIsWonderBonusLoading(false);
    } catch (error) {
      console.error("Error claiming wonder production bonus:", error);
      setIsWonderBonusLoading(false);
    }
    setIsWonderBonusLoading(false);
  };

  const structure = useComponentValue(
    dojo.setup.components.Structure,
    getEntityIdFromKeys([BigInt(structureEntityId)]),
  );

  useEffect(() => {
    const checkNearWonder = async () => {
      if (!structure) return;
      const wonderStructureId = await getSurroundingWonderBonusFromToriiClient(
        dojo.network.toriiClient,
        WONDER_BONUS_DISTANCE,
        {
          col: structure.base.coord_x,
          row: structure.base.coord_y,
        },
      );
      setWonderStructureId(wonderStructureId);
    };
    checkNearWonder();
  }, [structure]);

  const getNextRealmLevel = useMemo(() => {
    if (!structure) return null;
    const nextLevel = structure.base.level + 1;
    const res = nextLevel <= configManager.getMaxLevel(structure.base.category) ? nextLevel : null;
    return res;
  }, [structure]);

  const checkBalance = useMemo(() => {
    if (!getNextRealmLevel) return false;

    const cost = configManager.realmUpgradeCosts[getNextRealmLevel];

    return Object.keys(cost).every((resourceId) => {
      const resourceCost = cost[Number(resourceId)];
      const balance = getBalance(structureEntityId, resourceCost.resource, currentDefaultTick, dojo.setup.components);
      return divideByPrecision(balance.balance) >= resourceCost.amount;
    });
  }, [getBalance, structureEntityId]);

  const levelUpRealm = async () => {
    setIsLevelUpLoading(true);
    if (!structure) return;

    try {
      await dojo.setup.systemCalls.upgrade_realm({
        signer: dojo.account.account,
        realm_entity_id: structure?.entity_id,
      });
      setIsLevelUpLoading(false);
    } catch (error) {
      console.error("Error upgrading realm:", error);
      setIsLevelUpLoading(false);
    }
    setIsLevelUpLoading(false);
  };

  const resourcesProduced = useMemo(() => {
    return unpackValue(structure?.resources_packed || 0n);
  }, [structure]);

  if (!structure) return null;
  const isOwner = structure.owner === ContractAddress(dojo.account.account.address);

  return (
    structure && (
      <div className="castle-selector w-full text-sm">
        <div className="space-y-2">
          {/* Wonder Bonus Section */}
          {wonderStructureId && (
            <div className="bg-gradient-to-r from-gold/20 to-gold/5 border-2 border-gold/30 rounded-lg px-6 py-4 shadow-lg shadow-gold/10 relative overflow-hidden">
              <div className="absolute inset-0 bg-[url('/images/patterns/gold-pattern.png')] opacity-5"></div>
              <div className="relative">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="bg-gold/20 p-3 rounded-lg">
                      <SparklesIcon className="w-7 h-7 text-gold" />
                    </div>
                    <div>
                      <h6 className="text-gold font-bold text-lg mb-1">Wonder Bonus Available</h6>
                      <p className="text-gold/90 text-sm">
                        {hasActivatedWonderBonus
                          ? "✨ Currently receiving +20% production bonus"
                          : "Activate to receive +20% production bonus"}
                      </p>
                    </div>
                  </div>
                  {!hasActivatedWonderBonus && (
                    <Button
                      variant="outline"
                      onClick={onActivateWonderBonus}
                      isLoading={isWonderBonusLoading}
                      className="min-w-[160px] hover:bg-gold/10 animate-pulse"
                    >
                      Activate Bonus
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

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
                  variant={checkBalance ? "gold" : "outline"}
                  disabled={!checkBalance}
                  isLoading={isLevelUpLoading}
                  onClick={levelUpRealm}
                  className="w-full"
                >
                  {checkBalance ? `Upgrade to ${RealmLevels[getNextRealmLevel]}` : "Need Resources"}
                  <ArrowUpRightIcon className="w-4 h-4 ml-2" />
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
                </div>
              </div>
            )}
          </div>

          {/* Resources Section */}
          <div className="bg-gold/5 border border-gold/20 rounded-lg p-4">
            {structure &&
              (structure.base.category === StructureType.Realm || structure.base.category === StructureType.Castle) && (
                <RealmResourcesIO
                  size="md"
                  titleClassName="uppercase font-semibold text-gold"
                  resourcesProduced={resourcesProduced}
                />
              )}
          </div>

          {/* Labor Production Button */}
          {isOwner && (
            <div className="flex justify-center">
              <Button
                onClick={() => toggleModal(<ProductionModal preSelectedResource={ResourcesIds.Labor} />)}
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
