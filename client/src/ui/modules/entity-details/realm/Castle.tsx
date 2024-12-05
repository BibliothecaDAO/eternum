import { configManager } from "@/dojo/setup";
import { useDojo } from "@/hooks/context/DojoContext";
import { useGetRealm } from "@/hooks/helpers/useRealm";
import { useResourceBalance } from "@/hooks/helpers/useResources";
import { useStructureByEntityId } from "@/hooks/helpers/useStructures";
import useUIStore from "@/hooks/store/useUIStore";
import { RealmResourcesIO } from "@/ui/components/resources/RealmResourcesIO";
import Button from "@/ui/elements/Button";
import { ResourceCost } from "@/ui/elements/ResourceCost";
import { divideByPrecision, toHexString } from "@/ui/utils/utils";
import { LEVEL_DESCRIPTIONS, REALM_MAX_LEVEL, RealmLevels, StructureType } from "@bibliothecadao/eternum";
import { useMemo, useState } from "react";

export const Castle = () => {
  const dojo = useDojo();

  const structureEntityId = useUIStore((state) => state.structureEntityId);

  const { getBalance } = useResourceBalance();

  const [isLoading, setIsLoading] = useState(false);

  const realm = useGetRealm(structureEntityId).realm;

  const isOwner = toHexString(realm.owner) === dojo.account.account.address;

  const structure = useStructureByEntityId(structureEntityId);

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
    structure && (
      <div className="w-full text-sm">
        <div className="p-3">
          <div className="flex justify-between items-start gap-4">
            <div>
              <div className="flex items-center gap-4">
                <div className="text-2xl">{RealmLevels[realm.level]}</div>
                {getNextRealmLevel && isOwner && (
                  <Button variant="outline" disabled={!checkBalance} isLoading={isLoading} onClick={levelUpRealm}>
                    {checkBalance ? `Upgrade to ${RealmLevels[getNextRealmLevel]}` : "Need Resources"}
                  </Button>
                )}
              </div>
              {getNextRealmLevel && isOwner && (
                <div className="mt-4">
                  <p className="text-sm mb-4">
                    Next Level: {RealmLevels[realm.level + 1]},{" "}
                    {LEVEL_DESCRIPTIONS[(realm.level + 1) as keyof typeof LEVEL_DESCRIPTIONS]}
                  </p>
                  <div className="mb-2 font-semibold uppercase">Upgrade Cost to {RealmLevels[realm.level + 1]}</div>
                  <div className="flex gap-4">
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
          <div className="mt-6">
            {structure && structure.category === StructureType[StructureType.Realm] && (
              <RealmResourcesIO size="md" titleClassName="uppercase" realmEntityId={structure.entity_id} />
            )}
          </div>
        </div>
      </div>
    )
  );
};
