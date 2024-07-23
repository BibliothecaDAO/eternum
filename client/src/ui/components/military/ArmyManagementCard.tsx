import { ReactComponent as Map } from "@/assets/icons/common/world.svg";
import { useDojo } from "@/hooks/context/DojoContext";
import { useResourceBalance } from "@/hooks/helpers/useResources";
import useBlockchainStore from "@/hooks/store/useBlockchainStore";
import useUIStore from "@/hooks/store/useUIStore";
import Button from "@/ui/elements/Button";
import { NumberInput } from "@/ui/elements/NumberInput";
import TextInput from "@/ui/elements/TextInput";
import { currencyFormat, getEntityIdFromKeys } from "@/ui/utils/utils";
import { Position, ResourcesIds, U32_MAX } from "@bibliothecadao/eternum";
import { useComponentValue } from "@dojoengine/react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { formatSecondsInHoursMinutes } from "../cityview/realm/labor/laborUtils";

import { ArmyInfo } from "@/hooks/helpers/useArmies";
import { useStructuresFromPosition } from "@/hooks/helpers/useStructures";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";
import { EternumGlobalConfig, resources } from "@bibliothecadao/eternum";
import { LucideArrowRight } from "lucide-react";

type ArmyManagementCardProps = {
  owner_entity: bigint;
  army: ArmyInfo;
};

// TODO Unify this. Push all useComponentValues up to the top level
export const ArmyManagementCard = ({ owner_entity, army }: ArmyManagementCardProps) => {
  const {
    account: { account },
    network: { provider },
    setup: {
      systemCalls: { army_buy_troops },
      components: { Position },
    },
  } = useDojo();

  const { getBalance } = useResourceBalance();
  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);
  const [travelWindow, setSetTravelWindow] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [canCreate, setCanCreate] = useState(false);

  // TODO: Clean this up
  const armyPosition = { x: Number(army.position.x), y: Number(army.position.y) };

  const isPassiveTravel = useMemo(
    () =>
      army.arrivalTime && army.arrivalTime.arrives_at && nextBlockTimestamp
        ? army.arrivalTime.arrives_at > nextBlockTimestamp
        : false,
    [nextBlockTimestamp],
  );

  const rawEntityOwnerPosition = useComponentValue(
    Position,
    getEntityIdFromKeys([BigInt(army.entityOwner.entity_owner_id || 0)]),
  ) || {
    x: 0n,
    y: 0n,
  };
  const entityOwnerPosition = { x: Number(rawEntityOwnerPosition.x), y: Number(rawEntityOwnerPosition.y) };

  const checkSamePosition = useMemo(() => {
    return armyPosition.x === entityOwnerPosition.x && armyPosition.y === entityOwnerPosition.y;
  }, [entityOwnerPosition, armyPosition]);

  const [editName, setEditName] = useState(false);
  const [naming, setNaming] = useState("");

  const [troopCounts, setTroopCounts] = useState<{ [key: number]: number }>({
    [ResourcesIds.Knight]: 1000,
    [ResourcesIds.Crossbowman]: 1000,
    [ResourcesIds.Paladin]: 1000,
  });

  const handleTroopCountChange = (troopName: number, count: number) => {
    setTroopCounts((prev) => ({ ...prev, [troopName]: count }));
  };

  const handleBuyArmy = async () => {
    setIsLoading(true);
    army_buy_troops({
      signer: account,
      army_id: army.entity_id,
      payer_id: owner_entity,
      troops: {
        knight_count: troopCounts[ResourcesIds.Knight] * EternumGlobalConfig.resources.resourcePrecision || 0,
        paladin_count: troopCounts[ResourcesIds.Paladin] * EternumGlobalConfig.resources.resourcePrecision || 0,
        crossbowman_count: troopCounts[ResourcesIds.Crossbowman] * EternumGlobalConfig.resources.resourcePrecision || 0,
      },
    }).finally(() => setIsLoading(false));

    setTroopCounts({
      [ResourcesIds.Knight]: 0,
      [ResourcesIds.Crossbowman]: 0,
      [ResourcesIds.Paladin]: 0,
    });
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
      troopCounts[ResourcesIds.Crossbowman] === 0 &&
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
      weak: "Crossbowman",
      current: currencyFormat(army.troops.knight_count, 0),
    },
    {
      name: ResourcesIds.Crossbowman,
      cost: 10,
      attack: 10,
      defense: 10,
      strong: "Knight",
      weak: "Paladin",
      current: currencyFormat(army.troops.crossbowman_count, 0),
    },
    {
      name: ResourcesIds.Paladin,
      cost: 10,
      attack: 10,
      defense: 10,
      strong: "Crossbowman",
      weak: "Knight",
      current: currencyFormat(army.troops.paladin_count, 0),
    },
  ];

  return (
    <>
      <div className="flex justify-between   p-2 text-xs">
        {/* <Button size="xs" variant="default" onClick={() => setSetTravelWindow(true)}>
          travel
        </Button> */}
        <div className="self-center mr-auto px-3">
          {checkSamePosition ? "At Base " : armyPosition ? `On Map` : "Unknown"}
        </div>
        <div className="flex ml-auto italic self-center  px-3">
          {isPassiveTravel && nextBlockTimestamp ? (
            <>
              Traveling for{" "}
              {isPassiveTravel
                ? formatSecondsInHoursMinutes(Number(army.arrivalTime!.arrives_at) - nextBlockTimestamp)
                : "Arrives Next Tick"}
            </>
          ) : (
            "Idle"
          )}
        </div>
        <ViewOnMapButton position={armyPosition} />
      </div>
      <div className="flex flex-col relative  p-2">
        {travelWindow && (
          <>
            <TravelToLocation
              isTraveling={isPassiveTravel}
              checkSamePosition={checkSamePosition}
              entityOwnerPosition={{ x: Number(entityOwnerPosition.x), y: Number(entityOwnerPosition.y) }}
              army={army}
              position={armyPosition}
              onClose={() => setSetTravelWindow(false)}
            />
          </>
        )}

        <div className="flex justify-between   p-2">
          {editName ? (
            <div className="flex space-x-2">
              <TextInput
                placeholder="Type Name"
                className="h-full"
                value={naming}
                onChange={(name) => setNaming(name)}
              />
              <Button
                variant="default"
                isLoading={isLoading}
                onClick={async () => {
                  setIsLoading(true);

                  try {
                    await provider.set_entity_name({ signer: account, entity_id: army.entity_id, name: naming });
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
            <h3>{army.name}</h3>
          )}
          <Button size="xs" variant="default" onClick={() => setEditName(!editName)}>
            edit
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-3 my-4">
          {troops.map((troop) => {
            const balance = getBalance(owner_entity, troop.name).balance;

            const balanceFloor = Math.floor(balance / EternumGlobalConfig.resources.resourcePrecision);

            return (
              <div className="p-2 bg-gold/10 clip-angled-sm hover:bg-gold/30 flex flex-col" key={troop.name}>
                <div className="font-bold mb-4">
                  <div className="flex justify-between">
                    <div className="text-md">{ResourcesIds[troop.name]}</div>
                  </div>
                  <div className="px-2 py-1 bg-white/10 clip-angled-sm flex justify-between">
                    <ResourceIcon withTooltip={false} resource={ResourcesIds[troop.name]} size="lg" />
                    <div className="text-green self-center">x {troop.current}</div>
                  </div>
                </div>

                <div className="flex items-center mt-auto flex-col">
                  <div className="px-2 text-xs  font-bold mb-3">
                    Avail. [{currencyFormat(balance ? Number(balance) : 0, 0)}]
                  </div>
                  <NumberInput
                    max={
                      balance ? Math.min(balanceFloor, U32_MAX / EternumGlobalConfig.resources.resourcePrecision) : 0
                    }
                    min={0}
                    step={100}
                    value={troopCounts[troop.name]}
                    onChange={(amount) => handleTroopCountChange(troop.name, amount)}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <Button
          className="w-full "
          disabled={!canCreate}
          variant="primary"
          isLoading={isLoading}
          onClick={handleBuyArmy}
        >
          {checkSamePosition ? "Buy Troops" : "Must be at Base to Purchase"}
        </Button>
      </div>
    </>
  );
};

export const ViewOnMapIcon = ({ position, className }: { position: Position; className?: string }) => {
  const [location, setLocation] = useLocation();
  const setIsLoadingScreenEnabled = useUIStore((state) => state.setIsLoadingScreenEnabled);
  const moveCameraToColRow = useUIStore((state) => state.moveCameraToColRow);
  return (
    <Map
      className={className}
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
    />
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
      <span> map</span>
    </Button>
  );
};

interface TravelToLocationProps {
  isTraveling: boolean;
  checkSamePosition: boolean;
  entityOwnerPosition: Position;
  army: ArmyInfo;
  position: Position;
  onClose: () => void;
}

export const TravelToLocation = ({
  isTraveling,
  checkSamePosition,
  entityOwnerPosition,
  army,
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
                Traveling for{" "}
                {army.arrivalTime!.arrives_at
                  ? formatSecondsInHoursMinutes(Number(army.arrivalTime!.arrives_at))
                  : "Arrives Next Tick"}
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
                          travelling_entity_id: army.entity_id,
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
        {!army.protectee && army.health.lifetime > 0 && (
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
                                travelling_entity_id: army.entity_id,
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
