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
import {
  ContractAddress,
  LEVEL_DESCRIPTIONS,
  RealmLevels,
  ResourcesIds,
  StructureType,
} from "@bibliothecadao/types";
import { useDojo } from "@bibliothecadao/react";
import { useMemo, useState } from "react";
// todo: fix this
import { getBlockTimestamp } from "@/utils/timestamp";
import { ArrowUpRightIcon, PlusIcon } from "lucide-react";
export const Castle = () => {
  const dojo = useDojo();
  const currentDefaultTick = getBlockTimestamp().currentDefaultTick;
  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const toggleModal = useUIStore((state) => state.toggleModal);

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
        <div className="p-2 space-y-4">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 justify-between w-full">
                <h5 className="text-2xl">{RealmLevels[realmInfo.level]}</h5>
                {getNextRealmLevel && isOwner && (
                  <Button
                    variant={checkBalance ? "gold" : "outline"}
                    disabled={!checkBalance}
                    isLoading={isLoading}
                    onClick={levelUpRealm}
                  >
                    {checkBalance ? `Upgrade to ${RealmLevels[getNextRealmLevel]}` : "Need Resources"}

                    <ArrowUpRightIcon className="w-4 h-4 ml-4" />
                  </Button>
                )}
              </div>
            </div>

            {getNextRealmLevel && isOwner && (
              <div className="bg-gold/5 border border-gold/10 rounded px-4 py-4 space-y-3">
                <div>
                  <h6 className="">Upgrade Requirements for {RealmLevels[realmInfo.level + 1]}</h6>
                  <p className="text-gold/90 mb-3">
                    {LEVEL_DESCRIPTIONS[(realmInfo.level + 1) as keyof typeof LEVEL_DESCRIPTIONS]}
                  </p>
                  <div className="flex gap-3">
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

          <div className="pt-2">
            {structure && structure.structure.base.category === StructureType.Realm && (
              <RealmResourcesIO size="md" titleClassName="uppercase" realmEntityId={structure.entityId} />
            )}
          </div>

          {isOwner && (
            <div className="flex justify-center mt-4">
              <Button
                onClick={() => toggleModal(<ProductionModal preSelectedResource={ResourcesIds.Labor} />)}
                variant="primary"
                withoutSound
              >
                <div className="flex items-center gap-2">
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
