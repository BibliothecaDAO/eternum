import { Event } from "@/dojo/events/graphqlClient";
import { useDojo } from "@/hooks/context/DojoContext";
import { ArmyInfo } from "@/hooks/helpers/useArmies";
import useUIStore from "@/hooks/store/useUIStore";
import { CombatTarget } from "@/types";
import Button from "@/ui/elements/Button";
import { Headline } from "@/ui/elements/Headline";
import { ResourceCost } from "@/ui/elements/ResourceCost";
import { divideByPrecision } from "@/ui/utils/utils";
import { BuildingType, Resource } from "@bibliothecadao/eternum";
import { useEffect, useRef, useState } from "react";
import { Subscription } from "rxjs";
import { BUILDING_IMAGES_PATH } from "../construction/SelectPreviewBuilding";
import { ArmyChip } from "./ArmyChip";

export const EnnemyArmies = ({
  armies,
  ownArmySelected,
}: {
  armies: ArmyInfo[];
  ownArmySelected: ArmyInfo | undefined;
}) => {
  const { setBattleView } = useUIStore(({ setBattleView }) => ({
    setBattleView,
  }));

  return (
    <div>
      {armies.length !== 0 && (
        <>
          <Headline className="my-3">Ennemy armies</Headline>
          <div className="grid grid-cols-1 gap-2">
            {armies.map((army: ArmyInfo, index) => {
              const extraButton =
                ownArmySelected && !army.isMine ? (
                  <Button
                    onClick={() =>
                      setBattleView({
                        attackers: [ownArmySelected!],
                        defenders: { type: CombatTarget.Army, entities: [army] },
                      })
                    }
                  >
                    Combat
                  </Button>
                ) : undefined;
              return <ArmyChip key={index} army={army} extraButton={extraButton} />;
            })}
          </div>
        </>
      )}
    </div>
  );
};

export const PillageHistory = ({
  structureId,
  attackerRealmEntityId,
}: {
  structureId: bigint;
  attackerRealmEntityId: bigint;
}) => {
  const {
    setup: {
      updates: { eventUpdates },
    },
  } = useDojo();
  const [pillageHistory, setPillageHistory] = useState<any[]>([]);

  const subscriptionRef = useRef<Subscription | undefined>();
  const isComponentMounted = useRef(true);

  useEffect(() => {
    const subscribeToPillageHistory = async () => {
      if (!isComponentMounted.current) return;
      const observable = await eventUpdates.createPillageHistoryEvents(structureId, attackerRealmEntityId);
      const subscription = observable.subscribe((event) => {
        if (event) {
          const newPillage = formatPillageEvent(event);
          // todo: add battle sound
          // Check if component is still mounted
          setPillageHistory((prev) => [newPillage, ...prev]);
        }
      });
      subscriptionRef.current = subscription;
    };

    subscribeToPillageHistory();

    return () => {
      isComponentMounted.current = false;
      subscriptionRef.current?.unsubscribe(); // Ensure to unsubscribe on component unmount
    };
  }, [structureId, attackerRealmEntityId, eventUpdates]);

  const isPillageSucess = (history: any) => {
    return history.pillagedResources.length > 0 || history.destroyedBuildingType !== "None";
  };

  console.log(pillageHistory);

  return (
    <div className=" p-6 overflow-auto h-full ">
      <div className="m-3 text-center">
        <Headline>Pillage History</Headline>
      </div>
      <div className="overflow-scroll-y max-h-[300px] grid grid-cols-1 gap-4">
        {pillageHistory.reverse().map((history, index) => (
          <div key={index} className="group hover:bg-gold/10  relative bg-gold/20 text-gold  p-4 clip-angled ">
            {/* <div className="absolute top-0 left-0 p-2 text-sm">Army ID: {history.armyId.toString()}</div> */}
            <div className="flex justify-center items-center p-3">
              <div className="text-center">
                {/* <Headline>Outcome</Headline> */}
                <div className={`text-xl font-bold ${history.winner === 0 ? "text-blue-500" : "text-red-500"}`}>
                  {isPillageSucess(history) ? "Pillage Successful!" : "Pillage Failed"}
                </div>
              </div>
            </div>
            <div className="p-2">
              <div className="flex justify-around items-start my-2">
                <div className="text-center">
                  <div>Resources</div>
                  <div className="flex flex-wrap justify-center gap-4">
                    {history.pillagedResources.length > 0
                      ? history.pillagedResources.map((resource: Resource) => (
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
                {history.destroyedBuildingType !== undefined && (
                  <div className="text-center">
                    <Headline>Destroyed Building</Headline>
                    {history.destroyedBuildingType !== undefined && (
                      <img
                        src={`${
                          BUILDING_IMAGES_PATH[BuildingType[history.destroyedBuildingType as keyof typeof BuildingType]]
                        }`}
                        alt="Destroyed Building"
                        className="w-24 h-24 mx-auto"
                      />
                    )}
                    {/* Placeholder for Building Image */}
                    <div>{history.destroyedBuildingType}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const formatPillageEvent = (event: Event) => {
  const structureId = BigInt(event.keys[1]);
  const attackerRealmEntityId = BigInt(event.keys[2]);
  const armyId = BigInt(event.keys[3]);
  const owner = BigInt(event.keys[4]);

  const winner = Number(event.data[0]);
  const pillagedResources: Resource[] = [];
  for (let i = 0; i < Number(event.data[1]); i++) {
    pillagedResources.push({ resourceId: Number(event.data[2 + i * 2]), amount: Number(event.data[3 + i * 2]) });
  }
  const destroyedBuildingType = BuildingType[Number(event.data[2 + Number(event.data[1]) * 2])];

  return {
    structureId,
    attackerRealmEntityId,
    armyId,
    owner,
    winner,
    pillagedResources,
    destroyedBuildingType,
  };
};
