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
  getRealmInfo,
  getStructure,
} from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { ContractAddress, LEVEL_DESCRIPTIONS, RealmLevels, ResourcesIds, StructureType } from "@bibliothecadao/types";
import { useMemo, useState } from "react";
// todo: fix this
import { getBlockTimestamp } from "@/utils/timestamp";
import { ArrowUpRightIcon, CrownIcon, PlusIcon, SparklesIcon } from "lucide-react";

export const Castle = () => {
  const dojo = useDojo();
  const currentDefaultTick = getBlockTimestamp().currentDefaultTick;
  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const toggleModal = useUIStore((state) => state.toggleModal);
  const isNearWonder = true;
  const [hasActivatedWonderBonus, setHasActivatedWonderBonus] = useState(false);

  const [isLoading, setIsLoading] = useState(false);

  const realmInfo = useMemo(
    () => getRealmInfo(getEntityIdFromKeys([BigInt(structureEntityId)]), dojo.setup.components),
    [structureEntityId, dojo.setup.components],
  );

  const structure = useMemo(
    () => getStructure(structureEntityId, ContractAddress(dojo.account.account.address), dojo.setup.components),
    [structureEntityId, dojo.account.account.address, dojo.setup.components],
  );

  const getNextRealmLevel = useMemo(() => {
    if (!realmInfo) return null;
    const nextLevel = realmInfo.level + 1;
    const res = nextLevel <= configManager.getMaxLevel(realmInfo.category) ? nextLevel : null;
    return res;
  }, [realmInfo]);

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
    setIsLoading(true);
    if (!realmInfo) return;

    await dojo.setup.systemCalls.upgrade_realm({
      signer: dojo.account.account,
      realm_entity_id: realmInfo.entityId,
    });
    setIsLoading(false);
  };

  if (!realmInfo) return null;
  const isOwner = realmInfo.owner === ContractAddress(dojo.account.account.address);

  return (
    structure && (
      <div className="castle-selector w-full text-sm">
        <div className="p-4 space-y-6">
          {/* Wonder Bonus Section */}
          {isNearWonder && (
            <div className="bg-gold/5 border border-gold/20 rounded-lg px-4 py-3 shadow-lg shadow-gold/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-gold/10 p-2 rounded-lg">
                    <SparklesIcon className="w-6 h-6 text-gold" />
                  </div>
                  <div>
                    <h6 className="text-gold font-semibold">Wonder Bonus Available</h6>
                    <p className="text-sm text-gold/70">
                      {hasActivatedWonderBonus
                        ? "Currently receiving +20% production bonus"
                        : "Activate to receive +20% production bonus"}
                    </p>
                  </div>
                </div>
                <Button
                  variant={hasActivatedWonderBonus ? "gold" : "outline"}
                  onClick={() => setHasActivatedWonderBonus(!hasActivatedWonderBonus)}
                  disabled={isLoading}
                  className="min-w-[140px]"
                >
                  {hasActivatedWonderBonus ? "Deactivate Bonus" : "Activate Bonus"}
                </Button>
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
                <h5 className="text-2xl font-bold text-gold">{RealmLevels[realmInfo.level]}</h5>
              </div>

              {getNextRealmLevel && isOwner && (
                <Button
                  variant={checkBalance ? "gold" : "outline"}
                  disabled={!checkBalance}
                  isLoading={isLoading}
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
                    Upgrade Requirements for {RealmLevels[realmInfo.level + 1]}
                  </h6>
                  <p className="text-gold/90 mb-4 text-sm">
                    {LEVEL_DESCRIPTIONS[(realmInfo.level + 1) as keyof typeof LEVEL_DESCRIPTIONS]}
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
            {structure && structure.structure.base.category === StructureType.Realm && (
              <RealmResourcesIO
                size="md"
                titleClassName="uppercase font-semibold text-gold"
                realmEntityId={structure.entityId}
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
