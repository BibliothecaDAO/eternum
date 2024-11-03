import { configManager } from "@/dojo/setup";
import { useDojo } from "@/hooks/context/DojoContext";
import { useGetRealm } from "@/hooks/helpers/useRealm";
import { getResourceBalance } from "@/hooks/helpers/useResources";
import { useStructureByEntityId } from "@/hooks/helpers/useStructures";
import useUIStore from "@/hooks/store/useUIStore";
import { RealmResourcesIO } from "@/ui/components/resources/RealmResourcesIO";
import Button from "@/ui/elements/Button";
import { ResourceCost } from "@/ui/elements/ResourceCost";
import { divideByPrecision } from "@/ui/utils/utils";
import { LEVEL_DESCRIPTIONS, REALM_MAX_LEVEL, RealmLevels, StructureType } from "@bibliothecadao/eternum";
import { useMemo, useState } from "react";

export const Castle = () => {
  const dojo = useDojo();

  const structureEntityId = useUIStore((state) => state.structureEntityId);

  const { getBalance } = getResourceBalance();

  const [isLoading, setIsLoading] = useState(false);

  const realm = useGetRealm(structureEntityId).realm;

  const structure = useStructureByEntityId(structureEntityId);
  if (!structure) return;

  const getNextRealmLevel = useMemo(() => {
    const nextLevel = realm.level + 1;
    return nextLevel < REALM_MAX_LEVEL ? nextLevel : null;
  }, [realm.level]);

  const checkBalance = useMemo(() => {
    if (!getNextRealmLevel) return false;

    const cost = configManager.realmUpgradeCosts[getNextRealmLevel];

    return Object.keys(cost).every((resourceId) => {
      const resourceCost = cost[Number(resourceId)];
      const balance = getBalance(structureEntityId, resourceCost.resource);
      return divideByPrecision(balance.balance) >= resourceCost.amount;
    });
  }, [getBalance, structureEntityId]);

  const levelUpRealm = async () => {
    setIsLoading(true);

    await dojo.setup.systemCalls.upgrade_realm({
      signer: dojo.account.account,
      realm_entity_id: realm.entityId,
    });
    setIsLoading(false);
  };

  return (
    <div className="w-full text-sm">
      <div className="my-3">
        <div className="flex justify-between py-2 gap-4">
          <div>
            <div className="flex gap-4">
              <div className="text-2xl">{RealmLevels[realm.level]}</div>
              {getNextRealmLevel && (
                <Button variant="outline" disabled={!checkBalance} isLoading={isLoading} onClick={levelUpRealm}>
                  {checkBalance ? `Upgrade to ${RealmLevels[realm.level]}` : "Need Resources"}
                </Button>
              )}
            </div>
            {getNextRealmLevel && (
              <div>
                <p className="text-sm my-2">
                  Next Level: {RealmLevels[realm.level + 1]},{" "}
                  {LEVEL_DESCRIPTIONS[(realm.level + 1) as keyof typeof LEVEL_DESCRIPTIONS]}
                </p>
                <div className="my-2 font-semibold uppercase">Upgrade Cost to {RealmLevels[realm.level + 1]}</div>
                <div className="flex gap-2">
                  {configManager.realmUpgradeCosts[getNextRealmLevel]?.map((a) => (
                    <ResourceCost
                      key={a.resource}
                      className="!text-gold"
                      type="vertical"
                      size="xs"
                      resourceId={a.resource}
                      amount={a.amount}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="my-2">
          {structure && structure.category === StructureType[StructureType.Realm] && (
            <RealmResourcesIO size="md" titleClassName="uppercase" realmEntityId={structure.entity_id} />
          )}
        </div>
      </div>
    </div>
  );
};
