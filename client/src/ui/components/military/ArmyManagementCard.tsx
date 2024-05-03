import { currencyFormat, getEntityIdFromKeys } from "@/ui/utils/utils";
import { useDojo } from "@/hooks/context/DojoContext";
import { useResourceBalance } from "@/hooks/helpers/useResources";
import Button from "@/ui/elements/Button";
import TextInput from "@/ui/elements/TextInput";
import { ResourcesIds } from "@bibliothecadao/eternum";
import { useEffect, useMemo, useState } from "react";
import { useComponentValue } from "@dojoengine/react";
import { shortString } from "starknet";
import { NumberInput } from "@/ui/elements/NumberInput";
import useUIStore from "@/hooks/store/useUIStore";
import useBlockchainStore from "@/hooks/store/useBlockchainStore";
import { getComponentValue } from "@dojoengine/recs";
import { formatSecondsInHoursMinutes } from "../cityview/realm/labor/laborUtils";
import { useLocation } from "wouter";
import { RealmSelect, RealmsListComponent } from "../worldmap/realms/RealmsListComponent";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/ui/elements/Select";
import { useGetRealms } from "@/hooks/helpers/useRealm";
import useRealmStore from "@/hooks/store/useRealmStore";

export const nameMapping: { [key: number]: string } = {
  [ResourcesIds.Knight]: "Knight",
  [ResourcesIds.Crossbowmen]: "Crossbowman",
  [ResourcesIds.Paladin]: "Paladin",
};

// TODO Unify this. Push all useComponentValues up to the top level
export const ArmyManagementCard = ({ owner_entity, entity }: any) => {
  const {
    account: { account },
    network: { provider },
    setup: {
      systemCalls: { army_buy_troops, travel },
      components: { EntityName, Position, EntityOwner, ArrivalTime, TickMove },
    },
  } = useDojo();

  const { getBalance } = useResourceBalance();
  const { moveCameraToColRow } = useUIStore();
  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);
  const currentTick = useBlockchainStore((state) => state.currentTick);

  const [isLoading, setIsLoading] = useState(false);
  const [canCreate, setCanCreate] = useState(false);
  const [travelToBase, setTravelToBase] = useState(false);

  // TODO: Clean this up
  const name = useComponentValue(EntityName, getEntityIdFromKeys([BigInt(entity.entity_id)]));
  const position = useComponentValue(Position, getEntityIdFromKeys([BigInt(entity.entity_id)])) || { x: 0, y: 0 };
  const entityOwner = useComponentValue(EntityOwner, getEntityIdFromKeys([BigInt(entity.entity_id)]));
  const arrivalTime = useComponentValue(ArrivalTime, getEntityIdFromKeys([BigInt(entity.entity_id)]));

  const tickMove = useMemo(
    () => (entity.entityId ? getComponentValue(TickMove, getEntityIdFromKeys([entity.entityId])) : undefined),
    [entity.entityId],
  );

  const isPassiveTravel = useMemo(
    () => (arrivalTime?.arrives_at && nextBlockTimestamp ? arrivalTime?.arrives_at > nextBlockTimestamp : false),
    [arrivalTime, nextBlockTimestamp],
  );

  const isActiveTravel = useMemo(
    () => (tickMove !== undefined ? tickMove.tick >= currentTick : false),
    [tickMove, currentTick],
  );

  const isTraveling = useMemo(() => {
    return isPassiveTravel || isActiveTravel;
  }, [arrivalTime, nextBlockTimestamp]);

  const entityOwnerPosition = useComponentValue(
    Position,
    getEntityIdFromKeys([BigInt(entityOwner?.entity_owner_id || 0)]),
  ) || { x: 0, y: 0 };

  const checkSamePosition = useMemo(() => {
    return position.x === entityOwnerPosition.x && position.y === entityOwnerPosition.y;
  }, [entityOwnerPosition, position]);

  console.log(checkSamePosition);

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

  const [location, setLocation] = useLocation();
  const setIsLoadingScreenEnabled = useUIStore((state) => state.setIsLoadingScreenEnabled);

  const [travelLocation, setTravelLocation] = useState({ x: 0, y: 0 });

  const realms = useGetRealms();

  const handleSetTravelLocation = (realmId: string) => {
    const realm = realms.find((realm) => realm.entity_id.toString() === realmId);
    if (realm) {
      setTravelLocation({ x: realm.position.x, y: realm.position.y });
    }
  };

  return (
    <div className="flex flex-col">
      <div className="flex justify-between border-b py-2">
        {editName ? (
          <div className="flex space-x-2">
            <TextInput
              placeholder="Type Name"
              className="h-full border"
              value={naming}
              onChange={(name) => setNaming(name)}
            />
            <Button
              variant="primary"
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
          <h3>{name ? shortString.decodeShortString(name.name.toString()) : "Army"}</h3>
        )}
        <Button size="xs" variant="outline" onClick={() => setEditName(!editName)}>
          edit name
        </Button>
      </div>

      <div className="my-2 flex justify-between">
        <div className="flex">
          {/* <div className="mr-2 self-center">
            {checkSamePosition
              ? "At Base "
              : position
              ? `(x:${position.x.toLocaleString()}, y: ${position.y.toLocaleString()})`
              : "Unknown"}
          </div> */}

          <Button
            variant="outline"
            onClick={() => {
              if (location !== "/map") {
                setIsLoadingScreenEnabled(true);
                setTimeout(() => {
                  setLocation("/map");
                  if (position.x !== 0 && position.y !== 0) {
                    moveCameraToColRow(position.x, position.y, 0.01, true);
                    setTimeout(() => {
                      moveCameraToColRow(position.x, position.y, 1.5);
                    }, 10);
                  }
                }, 100);
              } else {
                if (position.x !== 0 && position.y !== 0) {
                  moveCameraToColRow(position.x, position.y);
                }
              }
              moveCameraToColRow(position.x, position.y, 1.5);
            }}
          >
            <span> view on map</span>
          </Button>
        </div>

        {!isTraveling && (
          <div className="flex space-x-2">
            {travelToBase ? (
              <>
                <Button
                  onClick={() =>
                    travel({
                      signer: account,
                      travelling_entity_id: entity.entity_id,
                      destination_coord_x: entityOwnerPosition.x,
                      destination_coord_y: entityOwnerPosition.y,
                    })
                  }
                  variant="outline"
                >
                  Confirm
                </Button>
                <Button onClick={() => setTravelToBase(false)} variant="outline">
                  Cancel
                </Button>
              </>
            ) : (
              <Button onClick={() => setTravelToBase(true)} variant="outline">
                Travel to Base
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-between">
        <div>
          <div className="my-2 uppercase mb-1 font-bold">Status:</div>
          {arrivalTime && isTraveling && nextBlockTimestamp ? (
            <div className="flex ml-auto -mt-2 italic ">
              Traveling for{" "}
              {isPassiveTravel
                ? formatSecondsInHoursMinutes(arrivalTime?.arrives_at - nextBlockTimestamp)
                : "Arrives Next Tick"}
            </div>
          ) : (
            "Idle"
          )}
        </div>
        {!isTraveling && (
          <div className="self-center">
            <div className="flex">
              <Select onValueChange={(value) => handleSetTravelLocation(value)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select a Realm" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {realms.map((realm) => {
                      return (
                        <SelectItem key={realm.entity_id} value={realm.entity_id.toString()}>
                          {realm.name}
                        </SelectItem>
                      );
                    })}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <Button
                onClick={() =>
                  travel({
                    signer: account,
                    travelling_entity_id: entity.entity_id,
                    destination_coord_x: travelLocation.x,
                    destination_coord_y: travelLocation.y,
                  })
                }
                variant="outline"
              >
                Travel
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 my-2">
        {troops.map((troop) => (
          <div className="p-2 border" key={troop.name}>
            <img src={`/images/units/${nameMapping[troop.name]}.png`} alt={nameMapping[troop.name]} />
            <h5 className="font-bold">
              {nameMapping[troop.name]} [{troop.current}]
            </h5>
            <div className="flex justify-between border px-2 uppercase my-2 font-bold">
              <div>Atk: {troop.attack}</div>
              <div>Def: {troop.defense}</div>
            </div>

            <div className="my-3">
              <div>Str vs {troop.strong}</div>
              <div>Wk vs {troop.weak}</div>
            </div>

            <div className="flex">
              <NumberInput
                max={Number(
                  currencyFormat(
                    getBalance(owner_entity, troop.name).balance
                      ? Number(getBalance(owner_entity, troop.name).balance)
                      : 0,
                    2,
                  ),
                )}
                min={0}
                value={troopCounts[troop.name]}
                onChange={(amount) => handleTroopCountChange(troop.name, amount)}
              />
              <div className="px-2">
                [
                {Number(
                  currencyFormat(
                    getBalance(owner_entity, troop.name).balance
                      ? Number(getBalance(owner_entity, troop.name).balance)
                      : 0,
                    2,
                  ),
                )}
                ]
              </div>
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
