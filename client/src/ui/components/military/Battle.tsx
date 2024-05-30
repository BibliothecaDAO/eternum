import useUIStore from "@/hooks/store/useUIStore";
import { useDojo } from "@/hooks/context/DojoContext";
import { useStructuresPosition } from "@/hooks/helpers/useStructures";
import { ArmyAndName, usePositionArmies } from "@/hooks/helpers/useArmies";
import { ArmyViewCard } from "./ArmyViewCard";
import Button from "@/ui/elements/Button";
import { useEffect, useMemo, useRef, useState } from "react";
import { RealmListItem } from "../worldmap/realms/RealmListItem";
import { Headline } from "@/ui/elements/Headline";
import { useModal } from "@/hooks/store/useModal";
import { ModalContainer } from "../ModalContainer";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { currencyFormat, divideByPrecision } from "@/ui/utils/utils";
import { Event } from "@/dojo/events/graphqlClient";
import { BuildingType, Resource } from "@bibliothecadao/eternum";
import { ResourceCost } from "@/ui/elements/ResourceCost";
import { Subscription } from "rxjs";
import { BUILDING_IMAGES_PATH } from "../construction/SelectPreviewBuilding";
import { ArmyChip } from "./ArmyChip";
import { StructureListItem } from "../worldmap/structures/StructureListItem";

export const ArmiesAtLocation = () => {
  const clickedHex = useUIStore((state) => state.clickedHex);
  const { col: x, row: y } = clickedHex!.contractPos;

  const { structuresAtPosition } = useStructuresPosition({ position: { x, y } });
  const { allArmies, userArmies } = usePositionArmies({ position: { x, y } });

  const { toggleModal } = useModal();

  return (
    <div>
      {/* {userArmies.length !== 0 && (
        <div className="my-3">
          <Headline className="my-3">Armies</Headline>
          <div className="grid grid-cols-3 gap-4">
            {userArmies.map((entity, index) => (
              <ArmyViewCard
                // active={entity.entity_id.toString() == selectedArmy}
                onClick={(value) => console.log(value)}
                key={index}
                army={entity}
              />
            ))}
          </div>
        </div>
      )} */}
      {allArmies.length !== 0 && (
        <>
          <Headline className="my-3">Armies</Headline>
          <div className="grid grid-cols-1 gap-2">
            {allArmies.map((entity: any, index) => (
              <ArmyChip key={index} army={entity} />
              // <ArmyViewCard
              //   actions={structuresAtPosition}
              //   onClick={() => {
              //     structuresAtPosition
              //       ? toggleModal(<ArmyActions armyId={entity.entity_id} />)
              //       : console.log("no structures");
              //   }}
              //   key={index}
              //   army={entity}
              // />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export const ArmyActions = ({ armyId }: { armyId: bigint }) => {
  const clickedHex = useUIStore((state) => state.clickedHex);
  const { col: x, row: y } = clickedHex!.contractPos;

  const { allArmies, userArmies } = usePositionArmies({ position: { x, y } });

  const army = allArmies.find((entity: any) => entity.entity_id === armyId) as ArmyAndName;

  const { formattedRealmAtPosition } = useStructuresPosition({ position: { x, y } });

  const filteredArmies = useMemo(() => {
    return allArmies.filter((entity) => entity.entity_id !== army.entity_id);
  }, [allArmies]);

  const [selectedArmyToAttack, setSelectedArmyToAttack] = useState<any>(null);

  const {
    account: { account },
    network: { provider },
    setup: {
      systemCalls: { create_army, army_buy_troops },
      components: { Protector, Army, Health },
    },
  } = useDojo();

  const [loading, setLoading] = useState(false);

  const getProtector = useMemo(() => {
    const protector = getComponentValue(
      Protector,
      getEntityIdFromKeys([BigInt(formattedRealmAtPosition?.entity_id || 0n)]),
    );
    const protectorArmy = getComponentValue(Army, getEntityIdFromKeys([BigInt(protector?.army_id || 0n)]));
    const health = getComponentValue(Health, getEntityIdFromKeys([BigInt(protectorArmy?.entity_id || 0n)]));

    return { ...protectorArmy, ...health };
  }, [allArmies]);

  const handleBattleStart = async () => {
    setLoading(true);

    await provider.battle_start({
      signer: account,
      attacking_army_id: army.entity_id,
      defending_army_id: selectedArmyToAttack,
    });

    setLoading(false);
  };

  const handlePillage = async () => {
    setLoading(true);

    await provider.battle_pillage({
      signer: account,
      army_id: army.entity_id,
      structure_id: formattedRealmAtPosition?.entity_id || 0n,
    });

    setLoading(false);
  };

  return (
    <ModalContainer>
      <div className="flex justify-center">
        <div className="grid grid-cols-12 gap-12 container ">
          <div className="col-span-3">
            <Headline className="my-3">
              <h4> Your Army</h4>
            </Headline>
            <ArmyViewCard army={army} />
          </div>
          <div className="border p-8 text-center col-span-6 space-y-8 flex flex-col justify-between">
            <div className="w-64">
              <Headline>
                <h5>{army?.name}</h5>
              </Headline>
              <p>
                You have a fighting chance to steal some resources. If victorious you will steal resources and return
                home.
              </p>
            </div>

            <div>
              {" "}
              <Button className=" h-32" isLoading={loading} variant="primary" onClick={() => handlePillage()}>
                Pillage {formattedRealmAtPosition.name}
              </Button>
            </div>

            <div className="w-64 ml-auto">
              <Headline>
                <h5>{formattedRealmAtPosition.name}</h5>
              </Headline>

              {getProtector.current ? (
                <>
                  {" "}
                  <h6> {Number(getProtector.current?.toString() || 0) / 1000}HP</h6>
                  <div className="flex justify-center gap-8 mt-4">
                    <div>Crossbowmen: {currencyFormat(getProtector?.troops?.crossbowman_count || 0, 0)}</div>
                    <div>Knight: {currencyFormat(getProtector?.troops?.knight_count || 0, 0)}</div>
                    <div>Paladin: {currencyFormat(getProtector?.troops?.paladin_count || 0, 0)}</div>
                  </div>
                </>
              ) : (
                "No Defending Army! Pillage Away"
              )}
            </div>
            <PillageHistory
              structureId={BigInt(formattedRealmAtPosition?.entity_id) || 0n}
              attackerRealmEntityId={BigInt(army.entity_owner_id)}
            />
          </div>
          <div className="col-span-3">
            <Headline className="my-3">
              <h4>Attackable</h4>
            </Headline>
            {/* {filteredArmies.length !== 0 ? (
              <>
                <div className="grid grid-cols-1">
                  {filteredArmies.map((entity, index) => (
                    <ArmyViewCard
                      active={entity.entity_id == selectedArmyToAttack}
                      onClick={setSelectedArmyToAttack}
                      key={index}
                      army={entity}
                    />
                  ))}
                </div>
              </>
            ) : (
              ""
            )} */}
            {formattedRealmAtPosition && (
              <div className="grid ">
                <RealmListItem realm={formattedRealmAtPosition} />
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="w-full my-8 flex justify-center">
        {selectedArmyToAttack && (
          <Button
            onClick={() =>
              provider.battle_start({
                signer: account,
                attacking_army_id: army.entity_id,
                defending_army_id: selectedArmyToAttack,
              })
            }
          >
            Start Battle
          </Button>
        )}{" "}
      </div>
    </ModalContainer>
  );
};

export const TroopCard = ({ count, id }: { count: number; id: number }) => {
  return (
    <div className="border p-4">
      <h5>{count}</h5>
    </div>
  );
};

export const Battle = () => {
  const clickedHex = useUIStore((state) => state.clickedHex);
  const { col: x, row: y } = clickedHex!.contractPos;
  const { formattedRealmAtPosition, formattedStructureAtPosition } = useStructuresPosition({ position: { x, y } });

  return (
    <>
      <Headline className="my-3">Structures</Headline>

      <div className="grid grid-cols-2">
        {formattedRealmAtPosition && <RealmListItem realm={formattedRealmAtPosition} />}
        {!formattedRealmAtPosition && formattedStructureAtPosition && (
          <StructureListItem structure={formattedStructureAtPosition} />
        )}
      </div>
    </>
  );
};

export const BattleStatusBar = ({
  healthArmyOne,
  healthArmyTwo,
  damagePerSecondArmyOne,
  damagePerSecondArmyTwo,
}: {
  healthArmyOne: number;
  healthArmyTwo: number;
  damagePerSecondArmyOne: number;
  damagePerSecondArmyTwo: number;
}) => {
  // Calculate the total health initially (could be set outside and passed as props if it changes)
  const totalHealth = healthArmyOne + healthArmyTwo;

  // Calculate the percentage of the bar each army occupies
  const armyOnePercentage = (healthArmyOne / totalHealth) * 100;
  const armyTwoPercentage = (healthArmyTwo / totalHealth) * 100;

  return (
    <>
      <div>
        <div className="flex justify-between my-3 mt-6">
          <div>
            {" "}
            <h4>Loaf</h4> Defending (-{damagePerSecondArmyOne} per tick)
          </div>
          <div>
            {" "}
            <h4>Click</h4> Attacking (-{damagePerSecondArmyTwo} per tick)
          </div>
        </div>
      </div>
      <div className="w-full flex h-8 border-2 border-gold">
        <div
          className="bg-blue-600/60 border-r-2 border-gold animate-pulse"
          style={{ width: `${armyOnePercentage}%` }}
        ></div>
        <div
          className="bg-red/60 border-l-2 border-gold animate-pulse"
          style={{ width: `${armyTwoPercentage}%` }}
        ></div>
      </div>
      <div className="flex justify-between">
        <div>{healthArmyOne} hp</div>
        <div>{healthArmyTwo} hp</div>
      </div>
    </>
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

  return (
    <div className="border p-2">
      <div className="m-3 text-center">
        <Headline>Pillage History</Headline>
      </div>
      <div className="overflow-auto max-h-[300px]">
        {pillageHistory.map((history, index) => (
          <div key={index} className="group hover:bg-gold/10 border relative bg-gold/5 text-gold my-3">
            <div className="absolute top-0 left-0 p-2 text-sm">Army ID: {history.armyId.toString()}</div>
            <div className="flex justify-center items-center p-3">
              <div className="text-center">
                <Headline>Outcome</Headline>
                <div className={`text-xl font-bold ${history.winner === 0 ? "text-blue-500" : "text-red-500"}`}>
                  {isPillageSucess(history) ? "Pillage Sucessful" : "Pillage Failed"}
                </div>
              </div>
            </div>
            <div className="p-2">
              <div className="flex justify-around items-start my-2">
                <div className="text-center">
                  <Headline>Pillaged Resources</Headline>
                  <div className="flex flex-wrap justify-center gap-4">
                    {history.pillagedResources.length > 0
                      ? history.pillagedResources.map((resource: Resource) => (
                          <ResourceCost
                            key={resource.resourceId}
                            resourceId={resource.resourceId}
                            amount={divideByPrecision(resource.amount)}
                          />
                        ))
                      : "None"}
                  </div>
                </div>
                <div className="text-center">
                  <Headline>Destroyed Building</Headline>
                  {history.destroyedBuildingType !== "None" && (
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
