import { currencyFormat, divideByPrecision, getEntityIdFromKeys } from "@/ui/utils/utils";
import { useDojo } from "@/hooks/context/DojoContext";
import { useResourceBalance } from "@/hooks/helpers/useResources";
import Button from "@/ui/elements/Button";
import TextInput from "@/ui/elements/TextInput";
import { Position, ResourcesIds } from "@bibliothecadao/eternum";
import { useEffect, useMemo, useState } from "react";
import { useComponentValue } from "@dojoengine/react";
import { NumberInput } from "@/ui/elements/NumberInput";
import useUIStore from "@/hooks/store/useUIStore";
import useBlockchainStore from "@/hooks/store/useBlockchainStore";
import { getComponentValue } from "@dojoengine/recs";
import { formatSecondsInHoursMinutes } from "../cityview/realm/labor/laborUtils";
import { useLocation } from "wouter";

import { useStructuresFromPosition } from "@/hooks/helpers/useStructures";
import { ArmyAndName } from "@/hooks/helpers/useArmies";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";
import { resources } from "@bibliothecadao/eternum";
import { LucideArrowRight } from "lucide-react";

export const nameMapping: { [key: number]: string } = {
  [ResourcesIds.Knight]: "Knight",
  [ResourcesIds.Crossbowmen]: "Crossbowman",
  [ResourcesIds.Paladin]: "Paladin",
};

type ArmyManagementCardProps = {
  owner_entity: bigint;
  entity: ArmyAndName;
};

// TODO Unify this. Push all useComponentValues up to the top level
export const ArmyManagementCard = ({ owner_entity, entity }: ArmyManagementCardProps) => {
  const {
    account: { account },
    network: { provider },
    setup: {
      systemCalls: { army_buy_troops },
      components: { Position, TickMove },
    },
  } = useDojo();

  const { getBalance } = useResourceBalance();
  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);
  const currentTick = useBlockchainStore((state) => state.currentTick);

  const [isLoading, setIsLoading] = useState(false);
  const [canCreate, setCanCreate] = useState(false);

  // TODO: Clean this up
  const position = { x: entity.x, y: entity.y };

  const tickMove = useMemo(
    () =>
      entity.entity_id ? getComponentValue(TickMove, getEntityIdFromKeys([BigInt(entity.entity_id || 0n)])) : undefined,
    [entity.entity_id],
  );

  const isPassiveTravel = useMemo(
    () => (entity.arrives_at && nextBlockTimestamp ? entity.arrives_at > nextBlockTimestamp : false),
    [nextBlockTimestamp],
  );

  const isActiveTravel = useMemo(
    () => (tickMove !== undefined ? tickMove.tick >= currentTick : false),
    [tickMove, currentTick],
  );

  const isTraveling = useMemo(() => {
    return isPassiveTravel || isActiveTravel;
  }, [nextBlockTimestamp]);

  const entityOwnerPosition = useComponentValue(
    Position,
    getEntityIdFromKeys([BigInt(entity.entity_owner_id || 0)]),
  ) || { x: 0, y: 0 };

  const checkSamePosition = useMemo(() => {
    return position.x === entityOwnerPosition.x && position.y === entityOwnerPosition.y;
  }, [entityOwnerPosition, position]);

  const [editName, setEditName] = useState(false);
  const [naming, setNaming] = useState("");

  const [troopCounts, setTroopCounts] = useState<{ [key: number]: number }>({
    [ResourcesIds.Knight]: 0,
    [ResourcesIds.Crossbowmen]: 0,
    [ResourcesIds.Paladin]: 0,
  });

  const handleTroopCountChange = (troopName: number, count: number) => {
    setTroopCounts((prev) => ({ ...prev, [troopName]: count }));
  };

  const handleBuyArmy = async () => {
    setIsLoading(true);
    army_buy_troops({
      signer: account,
      army_id: entity.entity_id,
      payer_id: owner_entity,
      troops: {
        knight_count: troopCounts[ResourcesIds.Knight] * 1000 || 0,
        paladin_count: troopCounts[ResourcesIds.Paladin] * 1000 || 0,
        crossbowman_count: troopCounts[ResourcesIds.Crossbowmen] * 1000 || 0,
      },
    }).finally(() => setIsLoading(false));
  };

  useEffect(() => {
    let canCreate = true;
    Object.keys(troopCounts).forEach((troopId) => {
      const count = troopCounts[Number(troopId)];
      const balance = getBalance(owner_entity, Number(troopId)).balance;
      if (count > balance) {
        canCreate = false;
      }
    });

    if (
      troopCounts[ResourcesIds.Knight] === 0 &&
      troopCounts[ResourcesIds.Crossbowmen] === 0 &&
      troopCounts[ResourcesIds.Paladin] === 0
    ) {
      canCreate = false;
    }

    if (!checkSamePosition) {
      canCreate = false;
    }

    setCanCreate(canCreate);
  }, [troopCounts]);

  const troops = [
    {
      name: ResourcesIds.Knight,
      cost: 10,
      attack: 10,
      defense: 10,
      strong: "Paladin",
      weak: "Crossbowmen",
      current: currencyFormat(entity.troops.knight_count, 0),
    },
    {
      name: ResourcesIds.Crossbowmen,
      cost: 10,
      attack: 10,
      defense: 10,
      strong: "Knight",
      weak: "Paladin",
      current: currencyFormat(entity.troops.crossbowman_count, 0),
    },
    {
      name: ResourcesIds.Paladin,
      cost: 10,
      attack: 10,
      defense: 10,
      strong: "Crossbowmen",
      weak: "Knight",
      current: currencyFormat(entity.troops.paladin_count, 0),
    },
  ];

  const [travelWindow, setSetTravelWindow] = useState(false);

  return (
    <div className="flex flex-col relative">
      {travelWindow && (
        <>
          <TravelToLocation
            isTraveling={isTraveling}
            checkSamePosition={checkSamePosition}
            entityOwnerPosition={entityOwnerPosition}
            entity={entity}
            position={position}
            onClose={() => setSetTravelWindow(false)}
          />
        </>
      )}

      <div className="flex justify-between border-b border-gold/20 py-2">
        {editName ? (
          <div className="flex space-x-2">
            <TextInput placeholder="Type Name" className="h-full" value={naming} onChange={(name) => setNaming(name)} />
            <Button
              variant="default"
              isLoading={isLoading}
              onClick={async () => {
                setIsLoading(true);

                try {
                  await provider.set_entity_name({ signer: account, entity_id: entity.entity_id, name: naming });
                } catch (e) {
                  console.error(e);
                }

                setIsLoading(false);
                setEditName(false);
              }}
            >
              Change Name
            </Button>
          </div>
        ) : (
          <h3>{entity.name}</h3>
        )}
        <Button size="xs" variant="default" onClick={() => setEditName(!editName)}>
          edit name
        </Button>
      </div>

      <div className="flex justify-between my-1">
        <Button variant="default" onClick={() => setSetTravelWindow(true)}>
          travel
        </Button>
        <div className="self-center mr-auto px-3">
          {checkSamePosition ? "At Base " : position ? `On Map` : "Unknown"}
        </div>
        <div className="flex ml-auto italic self-center  px-3">
          {isTraveling && nextBlockTimestamp ? (
            <>
              Traveling for{" "}
              {isPassiveTravel
                ? formatSecondsInHoursMinutes(entity.arrives_at - nextBlockTimestamp)
                : "Arrives Next Tick"}
            </>
          ) : (
            "Idle"
          )}
        </div>
        <ViewOnMapButton position={position} />
      </div>

      <div className="grid grid-cols-3 gap-2 my-1">
        {troops.map((troop) => (
          <div className="p-2 border  border-gold/20 flex flex-col" key={troop.name}>
            {/* <img src={`/images/units/${nameMapping[troop.name]}.png`} alt={nameMapping[troop.name]} /> */}
            <div className="font-bold">
              <div className="text-md">{nameMapping[troop.name]}</div>
              <div className="text-green">x {troop.current}</div>
            </div>

            <div className="my-3">
              <div>Str vs {troop.strong}</div>
              <div>Wk vs {troop.weak}</div>
            </div>

            <div className="flex items-center mt-auto flex-col">
              <div className="px-2 text-xs text-center text-green font-black">
                [
                {currencyFormat(
                  getBalance(owner_entity, troop.name).balance
                    ? Number(getBalance(owner_entity, troop.name).balance)
                    : 0,
                  0,
                )}
                ]
              </div>
              <NumberInput
                className=""
                max={divideByPrecision(getBalance(owner_entity, troop.name).balance)}
                min={0}
                value={troopCounts[troop.name]}
                onChange={(amount) => handleTroopCountChange(troop.name, amount)}
              />
            </div>
          </div>
        ))}
      </div>

      <Button className="w-full " disabled={!canCreate} variant="primary" isLoading={isLoading} onClick={handleBuyArmy}>
        {checkSamePosition ? "Buy Troops" : "Must be at Base to Purchase"}
      </Button>
    </div>
  );
};

export const ViewOnMapButton = ({ position, className }: { position: Position; className?: string }) => {
  const [location, setLocation] = useLocation();
  const setIsLoadingScreenEnabled = useUIStore((state) => state.setIsLoadingScreenEnabled);
  const moveCameraToColRow = useUIStore((state) => state.moveCameraToColRow);

  return (
    <Button
      className={className}
      variant="primary"
      size="xs"
      onClick={() => {
        if (location !== "/map") {
          setIsLoadingScreenEnabled(true);
          setTimeout(() => {
            setLocation("/map");
            if (Number(position.x) !== 0 && Number(position.y) !== 0) {
              moveCameraToColRow(position.x, position.y, 0.01, true);
              setTimeout(() => {
                moveCameraToColRow(position.x, position.y, 1.5);
              }, 10);
            }
          }, 100);
        } else {
          if (Number(position.x) !== 0 && Number(position.y) !== 0) {
            moveCameraToColRow(position.x, position.y);
          }
        }
        moveCameraToColRow(position.x, position.y, 1.5);
      }}
    >
      <span> view on map</span>
    </Button>
  );
};

interface TravelToLocationProps {
  isTraveling: boolean;
  checkSamePosition: boolean;
  entityOwnerPosition: Position;
  entity: ArmyAndName;
  position: Position;
  onClose: () => void;
}

export const TravelToLocation = ({
  isTraveling,
  checkSamePosition,
  entityOwnerPosition,
  entity,
  position,
  onClose,
}: TravelToLocationProps) => {
  const [travelToBase, setTravelToBase] = useState(false);

  const { realms } = useStructuresFromPosition({ position });

  const {
    account: { account },
    setup: {
      systemCalls: { travel },
    },
  } = useDojo();

  const handleSetTravelLocation = (realmId: string) => {
    const realm = realms.find((realm) => realm?.entity_id.toString() === realmId);
    if (realm) {
      return { x: realm.position.x, y: realm.position.y };
    }
    return { x: 0, y: 0 };
  };

  return (
    <div className="absolute h-full w-full bg-brown top-0 z-10 ">
      <div className="flex justify-between mb-3">
        <div className="flex">
          <div className="my-2 uppercase mb-1 font-bold">Status:</div>
          <div className="flex ml-2 italic self-center">
            {isTraveling ? (
              <>
                Traveling for {entity.arrives_at ? formatSecondsInHoursMinutes(entity.arrives_at) : "Arrives Next Tick"}
              </>
            ) : (
              "Idle"
            )}
          </div>
        </div>
        <div className="flex">
          <div>
            {!isTraveling && !checkSamePosition && (
              <div className="flex space-x-2">
                {travelToBase ? (
                  <>
                    <Button
                      onClick={() => {
                        travel({
                          signer: account,
                          travelling_entity_id: entity.entity_id,
                          destination_coord_x: entityOwnerPosition.x,
                          destination_coord_y: entityOwnerPosition.y,
                        });

                        onClose();
                      }}
                      variant="outline"
                    >
                      Confirm
                    </Button>
                    <Button onClick={() => setTravelToBase(false)} variant="outline">
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button onClick={() => setTravelToBase(true)} variant="primary">
                    Travel to Back to Base
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        <div>
          <Button size="xs" variant="danger" onClick={onClose}>
            management <LucideArrowRight className="w-3" />
          </Button>
        </div>
      </div>
      <div className="border p-2 ">
        {!entity.protectee_id && entity.lifetime > 0 && (
          <div>
            <div className="flex justify-between">
              {!isTraveling && (
                <div className="self-center w-full h-48 overflow-y-scroll">
                  {realms.map((realm) => {
                    return (
                      <div className="flex  my-1 hover:bg-crimson/20" key={realm?.entity_id}>
                        <div className="uppercase self-center">{realm?.name}</div>

                        <div className="flex space-x-2 justify-start px-3 ml-auto self-center">
                          {realm?.resources.map((resource, index) => (
                            <ResourceIcon
                              key={index}
                              size="sm"
                              resource={resources.find((r) => r.id === resource)?.trait || ""}
                            />
                          ))}
                        </div>

                        <div className="ml-4">
                          <Button
                            onClick={() => {
                              travel({
                                signer: account,
                                travelling_entity_id: entity.entity_id,
                                destination_coord_x: handleSetTravelLocation(realm?.entity_id.toString() || "").x,
                                destination_coord_y: handleSetTravelLocation(realm?.entity_id.toString() || "").y,
                              });

                              onClose();
                            }}
                            variant="primary"
                          >
                            Travel - {realm?.timeToTravel}hrs
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
