import { ClientComponents } from "@/dojo/createClientComponents";
import { useDojo } from "@/hooks/context/DojoContext";
import { BUILDING_IMAGES_PATH } from "@/ui/config";
import { Headline } from "@/ui/elements/Headline";
import { ResourceCost } from "@/ui/elements/ResourceCost";
import { divideByPrecision } from "@/ui/utils/utils";
import { BattleSide, BuildingType, ID, Resource } from "@bibliothecadao/eternum";
import { ComponentValue, defineQuery, getComponentValue, HasValue, isComponentUpdate } from "@dojoengine/recs";
import { useEffect, useMemo, useState } from "react";

type PillageEvent = ComponentValue<ClientComponents["events"]["BattlePillageData"]["schema"]>;

const formatResources = (resources: any[]): Resource[] => {
  return resources.map((resource) => ({
    resourceId: Number(resource[0].value),
    amount: Number(resource[1].value),
  }));
};

const PillageHistoryItem = ({ history }: { history: PillageEvent }) => {
  const isSuccess = history.winner === BattleSide[BattleSide.Attack];
  const formattedResources = useMemo(() => formatResources(history.pillaged_resources), [history.pillaged_resources]);

  return (
    <div className="group hover:bg-gold/10 relative bg-gold/20 text-gold p-4">
      <div className="flex justify-center items-center p-3">
        <div className="text-center">
          <div className={`text-xl font-bold ${isSuccess ? "text-blue-500" : "text-red-500"}`}>
            {isSuccess ? "Pillage Successful!" : "Pillage Failed"}
          </div>
        </div>
      </div>
      <div className="p-2">
        <div className="flex justify-around items-start my-2">
          <div className="text-center">
            <div>Resources</div>
            <div className="flex flex-wrap justify-center gap-4">
              {formattedResources.length > 0
                ? formattedResources.map((resource: Resource) => (
                    <ResourceCost
                      size="lg"
                      textSize="lg"
                      key={resource.resourceId}
                      resourceId={resource.resourceId}
                      amount={divideByPrecision(resource.amount)}
                    />
                  ))
                : "None"}
            </div>
          </div>
          {history.destroyed_building_category !== BuildingType[BuildingType.None] && (
            <div className="text-center">
              <Headline>Destroyed Building</Headline>
              {
                <img
                  src={`${
                    BUILDING_IMAGES_PATH[
                      BuildingType[
                        history.destroyed_building_category as keyof typeof BuildingType
                      ] as keyof typeof BUILDING_IMAGES_PATH
                    ]
                  }`}
                  alt="Destroyed Building"
                  className="w-24 h-24 mx-auto"
                />
              }
              <div>{history.destroyed_building_category.replace(/([A-Z])/g, " $1").trim()}</div>
            </div>
          )}
        </div>
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

  useEffect(() => {
    const query = defineQuery([HasValue(events.BattlePillageData, { pillaged_structure_entity_id: structureId })], {
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
        <div className="text-center mb-4">
          <Headline>Pillage History</Headline>
        </div>
        <div className="overflow-scroll-y max-h-[300px] grid grid-cols-1 gap-4">
          {pillageHistory.map((history, index) => (
            <PillageHistoryItem key={index} history={history} />
          ))}
        </div>
      </div>
    </div>
  );
};
