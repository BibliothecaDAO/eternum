import { ReactComponent as Pen } from "@/assets/icons/common/pen.svg";
import { ReactComponent as Trash } from "@/assets/icons/common/trashcan.svg";
import { ReactComponent as Map } from "@/assets/icons/common/world.svg";

import { useDojo } from "@/hooks/context/DojoContext";
import { getResourceBalance } from "@/hooks/helpers/useResources";
import useUIStore from "@/hooks/store/useUIStore";
import Button from "@/ui/elements/Button";
import { NumberInput } from "@/ui/elements/NumberInput";
import TextInput from "@/ui/elements/TextInput";
import { currencyFormat, formatNumber, formatSecondsInHoursMinutes, getEntityIdFromKeys } from "@/ui/utils/utils";
import { ID, Position, ResourcesIds, U32_MAX } from "@bibliothecadao/eternum";
import { useComponentValue } from "@dojoengine/react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ArmyManager } from "@/dojo/modelManager/ArmyManager";
import { ArmyInfo } from "@/hooks/helpers/useArmies";
import { useQuery } from "@/hooks/helpers/useQuery";
import { useStructuresFromPosition } from "@/hooks/helpers/useStructures";
import { Position as PositionInterface } from "@/types/Position";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";
import { EternumGlobalConfig, resources } from "@bibliothecadao/eternum";
import clsx from "clsx";
import { LucideArrowRight } from "lucide-react";

const MAX_TROOPS_PER_ARMY = EternumGlobalConfig.troop.maxTroopCount;

type ArmyManagementCardProps = {
  owner_entity: ID;
  army: ArmyInfo | undefined;
  setSelectedEntity?: (entity: ArmyInfo | null) => void;
};

// TODO Unify this. Push all useComponentValues up to the top level
export const ArmyManagementCard = ({ owner_entity, army, setSelectedEntity }: ArmyManagementCardProps) => {
  const {
    account: { account },
    network: { provider },
    setup: {
      systemCalls: { army_buy_troops },
      components: { Position },
    },
  } = useDojo();

  const dojo = useDojo();

  const isDefendingArmy = Boolean(army?.protectee);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const { getBalance } = getResourceBalance();
  const nextBlockTimestamp = useUIStore((state) => state.nextBlockTimestamp);
  const [travelWindow, setSetTravelWindow] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [canCreate, setCanCreate] = useState(false);

  // TODO: Clean this up
  const armyPosition = { x: Number(army?.position.x || 0), y: Number(army?.position.y || 0) };

  const isPassiveTravel = useMemo(
    () =>
      army?.arrivalTime && army?.arrivalTime.arrives_at && nextBlockTimestamp
        ? army?.arrivalTime.arrives_at > nextBlockTimestamp
        : false,
    [nextBlockTimestamp],
  );

  const rawEntityOwnerPosition = useComponentValue(
    Position,
    getEntityIdFromKeys([BigInt(army?.entityOwner.entity_owner_id || 0)]),
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
    [ResourcesIds.Knight]: 0,
    [ResourcesIds.Crossbowman]: 0,
    [ResourcesIds.Paladin]: 0,
  });

  const remainingTroops = useMemo(() => {
    return (
      Math.max(0, MAX_TROOPS_PER_ARMY - Object.values(troopCounts).reduce((a, b) => a + b, 0)) -
      Number(army?.quantity.value)
    );
  }, [troopCounts]);

  const getMaxTroopCount = useCallback(
    (balance: number, troopName: number) => {
      const balanceFloor = Math.floor(balance / EternumGlobalConfig.resources.resourcePrecision);
      if (!balance) return 0;

      const maxFromBalance = Math.min(balanceFloor, U32_MAX / EternumGlobalConfig.resources.resourcePrecision);

      if (isDefendingArmy) {
        return maxFromBalance;
      } else {
        return Math.min(maxFromBalance, remainingTroops + troopCounts[troopName]);
      }
    },
    [isDefendingArmy, remainingTroops, troopCounts],
  );

  const handleTroopCountChange = (troopName: number, count: number) => {
    setTroopCounts((prev) => ({ ...prev, [troopName]: count }));
  };

  const handleDeleteArmy = async () => {
    setIsLoading(true);
    const armyManager = new ArmyManager(dojo);

    try {
      await armyManager.deleteArmy(army?.entity_id || 0);
      setSelectedEntity && setSelectedEntity(null);
    } catch (e) {
      console.error(e);
    }
    setIsLoading(false);
  };

  const handleBuyArmy = async () => {
    setIsLoading(true);
    army_buy_troops({
      signer: account,
      army_id: army?.entity_id || 0n,
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
      current: currencyFormat(Number(army?.troops.knight_count || 0), 0),
    },
    {
      name: ResourcesIds.Crossbowman,
      cost: 10,
      attack: 10,
      defense: 10,
      strong: "Knight",
      weak: "Paladin",
      current: currencyFormat(Number(army?.troops.crossbowman_count || 0), 0),
    },
    {
      name: ResourcesIds.Paladin,
      cost: 10,
      attack: 10,
      defense: 10,
      strong: "Crossbowman",
      weak: "Knight",
      current: currencyFormat(Number(army?.troops.paladin_count || 0), 0),
    },
  ];

  return (
    army && (
      <>
        <div className="flex justify-between   p-2 text-xs">
          <div className="self-center mr-auto px-3">
            {checkSamePosition ? "At Base " : armyPosition ? `On Map` : "Unknown"}
          </div>
          <div className="flex ml-auto italic self-center  px-3">
            {isPassiveTravel && nextBlockTimestamp ? (
              <>
                Traveling for{" "}
                {isPassiveTravel
                  ? formatSecondsInHoursMinutes(Number(army?.arrivalTime!.arrives_at || 0) - nextBlockTimestamp)
                  : "Arrives Next Tick"}
              </>
            ) : (
              "Idle"
            )}
          </div>
          <ViewOnMapIcon position={armyPosition} />
        </div>
        <div className="flex flex-col relative  p-2">
          {travelWindow && (
            <>
              <TravelToLocation
                isTraveling={isPassiveTravel}
                checkSamePosition={checkSamePosition}
                entityOwnerPosition={{ x: entityOwnerPosition.x, y: entityOwnerPosition.y }}
                army={army}
                position={armyPosition}
                onClose={() => setSetTravelWindow(false)}
              />
            </>
          )}

          <div className="flex justify-between p-2">
            {editName ? (
              <div className="flex space-x-2">
                <TextInput placeholder="Type Name" className="h-full" onChange={(name) => setNaming(name)} />
                <Button
                  variant="default"
                  isLoading={isLoading}
                  onClick={async () => {
                    setIsLoading(true);

                    try {
                      await provider.set_entity_name({ signer: account, entity_id: army.entity_id, name: naming });
                      army.name = naming;
                    } catch (e) {
                      console.error(e);
                    }

                    setIsLoading(false);
                    setEditName(false);
                  }}
                >
                  Change Name
                </Button>
                <Pen
                  className="ml-2 self-center m-auto w-12 h-12 fill-gold hover:scale-125 hover:animate-pulse duration-300 transition-all"
                  onClick={() => setEditName(!editName)}
                />
              </div>
            ) : (
              <div className="flex flex-row">
                <h3 className="mr-auto">{army.name}</h3>
                <Pen
                  className="ml-2 self-center m-auto w-6 h-6 fill-gold hover:scale-125 hover:animate-pulse duration-300 transition-all"
                  onClick={() => setEditName(!editName)}
                />
              </div>
            )}
            {army.health.current === 0n && !army.protectee && (
              <div className="flex items-center">
                {confirmDelete ? (
                  <Button
                    variant="danger"
                    onClick={() => {
                      handleDeleteArmy();
                      setConfirmDelete(false);
                    }}
                  >
                    Delete
                  </Button>
                ) : (
                  <Trash
                    className="ml-2 self-center m-auto w-6 h-6 fill-red/70 hover:scale-125 hover:animate-pulse duration-300 transition-all"
                    onClick={() => setConfirmDelete(true)}
                  />
                )}
              </div>
            )}
          </div>

          {!isDefendingArmy && (
            <div className="text-xs text-yellow-500 mb-2">
              ⚠️ Maximum troops per attacking army is {formatNumber(MAX_TROOPS_PER_ARMY, 0)}
            </div>
          )}

          <div className="grid grid-cols-3 gap-3 my-4">
            {troops.map((troop) => {
              const balance = getBalance(owner_entity, troop.name).balance;

              return (
                <div className="p-2 bg-gold/10  hover:bg-gold/30 flex flex-col" key={troop.name}>
                  <div className="font-bold mb-4">
                    <div className="flex justify-between">
                      <div className="text-md">{ResourcesIds[troop.name]}</div>
                    </div>
                    <div className="px-2 py-1 bg-white/10  flex justify-between">
                      <ResourceIcon withTooltip={false} resource={ResourcesIds[troop.name]} size="lg" />
                      <div className="text-green self-center">x {troop.current}</div>
                    </div>
                  </div>

                  <div className="flex items-center mt-auto flex-col">
                    <div className="px-2 text-xs  font-bold mb-3">
                      Avail. [{currencyFormat(balance ? Number(balance) : 0, 0)}]
                    </div>
                    <NumberInput
                      max={getMaxTroopCount(balance, troop.name)}
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
            {checkSamePosition ? "Reinforce army" : "Must be at Base to Reinforce"}
          </Button>
        </div>
      </>
    )
  );
};

export const ViewOnMapIcon = ({ position, className }: { position: Position; className?: string }) => {
  const { handleUrlChange, isMapView } = useQuery();

  const setIsLoadingScreenEnabled = useUIStore((state) => state.setIsLoadingScreenEnabled);
  const setTooltip = useUIStore((state) => state.setTooltip);

  const url = new PositionInterface(position).toMapLocationUrl();

  return (
    <Map
      className={clsx(
        "h-5 w-5 fill-gold hover:fill-gold/50 hover:animate-pulse duration-300 transition-all",
        className,
      )}
      onClick={() => {
        setTooltip(null);
        handleUrlChange(url);
        if (!isMapView) {
          setIsLoadingScreenEnabled(true);
        }
      }}
      onMouseEnter={() => {
        setTooltip({
          content: "View on Map",
          position: "top",
        });
      }}
      onMouseLeave={() => {
        setTooltip(null);
      }}
    />
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

const TravelToLocation = ({
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
    <div className="absolute h-full w-full bg-black/90 top-0 z-10 ">
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
