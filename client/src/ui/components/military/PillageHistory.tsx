import { ClientComponents } from "@/dojo/createClientComponents";
import { useDojo } from "@/hooks/context/DojoContext";
import { getEntitiesUtils } from "@/hooks/helpers/useEntities";
import { ResourceCost } from "@/ui/elements/ResourceCost";
import { divideByPrecision, formatSecondsLeftInDaysHoursMinutes } from "@/ui/utils/utils";
import { BattleSide, ID, Resource } from "@bibliothecadao/eternum";
import { ComponentValue, defineQuery, getComponentValue, Has, isComponentUpdate } from "@dojoengine/recs";
import { useEffect, useMemo, useState } from "react";

type PillageEvent = ComponentValue<ClientComponents["events"]["BattlePillageData"]["schema"]>;

const formatResources = (resources: any[]): Resource[] => {
  return resources.map((resource) => ({
    resourceId: Number(resource[0].value),
    amount: Number(resource[1].value),
  }));
};

const PillageHistoryItem = ({ addressName, history }: { addressName: string; history: PillageEvent }) => {
  const isSuccess = history.winner === BattleSide[BattleSide.Attack];
  const formattedResources = useMemo(() => formatResources([]), []);

  return (
    <div className="group hover:bg-gold/10 relative bg-gold/20 text-gold p-3">
      <div className="flex w-full justify-between font-bold ">
        <div className={`text-lg ${isSuccess ? "text-order-brilliance" : "text-order-giants"}`}>
          {isSuccess ? "Success" : "Fail"}
        </div>
        <div>{`player: ${addressName}`}</div>
      </div>
      <div className="flex justify-between items-start mt-2">
        <div>
          <div className="flex flex-wrap gap-2">
            {formattedResources.length > 0
              ? formattedResources.map((resource: Resource) => (
                  <ResourceCost
                    size="sm"
                    textSize="xs"
                    key={resource.resourceId}
                    resourceId={resource.resourceId}
                    amount={divideByPrecision(resource.amount)}
                  />
                ))
              : "None"}
          </div>
        </div>
        <div>
          <div className="text-sm">Destroyed Building</div>
          <div className="text-xs">{history.destroyed_building_category.replace(/([A-Z])/g, " $1").trim()}</div>
        </div>
      </div>
      <div className="absolute bottom-1 right-2 text-xs text-gold/60">
        {`${formatSecondsLeftInDaysHoursMinutes(Date.now() / 1000 - history.timestamp)} ago`}
      </div>
    </div>
  );
};

export const PillageHistory = ({ structureId }: { structureId: ID }) => {
  const {
    setup: {
      components: { events },
    },
  } = useDojo();

  const [pillageHistory, setPillageHistory] = useState<PillageEvent[]>([]);

  const { getAddressNameFromEntity } = getEntitiesUtils();

  useEffect(() => {
    const query = defineQuery([Has(events.BattlePillageData)], {
      runOnInit: true,
    });

    const subscription = query.update$.subscribe((update) => {
      if (isComponentUpdate(update, events.BattlePillageData)) {
        const event = getComponentValue(events.BattlePillageData, update.entity);
        setPillageHistory((prev) => [event!, ...prev]);
      }
    });

    return () => subscription.unsubscribe();
  }, [events.BattlePillageData, structureId]);

  return (
    <div className="p-6 h-full pt-12">
      <div className="overflow-auto h-full">
        <div className="overflow-scroll-y max-h-[300px] grid grid-cols-1 gap-4">
          {pillageHistory
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 20)
            .map((history, index) => {
              const addressName = getAddressNameFromEntity(history.pillager_army_entity_id);
              return <PillageHistoryItem key={index} addressName={addressName || ""} history={history} />;
            })}
        </div>
      </div>
    </div>
  );
};
