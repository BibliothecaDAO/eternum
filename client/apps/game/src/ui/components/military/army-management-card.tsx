import { ReactComponent as Pen } from "@/assets/icons/common/pen.svg";
import { ReactComponent as Trash } from "@/assets/icons/common/trashcan.svg";
import { ReactComponent as Map } from "@/assets/icons/common/world.svg";
import { useNavigateToMapView } from "@/hooks/helpers/use-navigate";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { Position as PositionInterface } from "@/types/position";
import Button from "@/ui/elements/button";
import { NumberInput } from "@/ui/elements/number-input";
import { ResourceIcon } from "@/ui/elements/resource-icon";
import TextInput from "@/ui/elements/text-input";
import { currencyFormat, formatNumber, formatStringNumber, getEntityIdFromKeys } from "@/ui/utils/utils";
import { getBlockTimestamp } from "@/utils/timestamp";
import {
  ArmyInfo,
  ArmyManager,
  configManager,
  divideByPrecision,
  getBalance,
  ID,
  multiplyByPrecision,
  ResourcesIds,
} from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { useComponentValue } from "@dojoengine/react";
import clsx from "clsx";
import { useEffect, useState } from "react";

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
      components: { Position },
    },
  } = useDojo();

  const dojo = useDojo();
  const currentDefaultTick = getBlockTimestamp().currentDefaultTick;

  const maxTroopCountPerArmy = configManager.getTroopConfig().maxTroopCount;

  const armyManager = new ArmyManager(dojo.setup.network.provider, dojo.setup.components, army?.entity_id || 0);

  const isDefendingArmy = Boolean(army?.protectee);

  const [confirmDelete, setConfirmDelete] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [canCreate, setCanCreate] = useState(false);

  // TODO: Clean this up
  const armyPosition = { x: Number(army?.position.x || 0), y: Number(army?.position.y || 0) };

  const rawEntityOwnerPosition = useComponentValue(
    Position,
    getEntityIdFromKeys([BigInt(army?.entityOwner.entity_owner_id || 0)]),
  ) || {
    x: 0n,
    y: 0n,
  };
  const entityOwnerPosition = { x: Number(rawEntityOwnerPosition.x), y: Number(rawEntityOwnerPosition.y) };

  const [editName, setEditName] = useState(false);
  const [naming, setNaming] = useState("");

  const [troopCounts, setTroopCounts] = useState<{ [key: number]: number }>({
    [ResourcesIds.Knight]: 0,
    [ResourcesIds.Crossbowman]: 0,
    [ResourcesIds.Paladin]: 0,
  });

  const handleTroopCountChange = (troopName: number, count: number) => {
    setTroopCounts((prev) => ({ ...prev, [troopName]: count }));
  };

  const handleDeleteArmy = async () => {
    setIsLoading(true);

    try {
      await armyManager.deleteArmy(account, army?.entity_id || 0);
      setSelectedEntity && setSelectedEntity(null);
    } catch (e) {
      console.error(e);
    }
    setIsLoading(false);
  };

  const handleBuyArmy = async () => {
    setIsLoading(true);
    armyManager.addTroops(account, {
      [ResourcesIds.Knight]: multiplyByPrecision(troopCounts[ResourcesIds.Knight]),
      [ResourcesIds.Crossbowman]: multiplyByPrecision(troopCounts[ResourcesIds.Crossbowman]),
      [ResourcesIds.Paladin]: multiplyByPrecision(troopCounts[ResourcesIds.Paladin]),
    });

    setTroopCounts({
      [ResourcesIds.Knight]: 0,
      [ResourcesIds.Crossbowman]: 0,
      [ResourcesIds.Paladin]: 0,
    });

    setIsLoading(false);
  };

  useEffect(() => {
    let canCreate = true;
    Object.keys(troopCounts).forEach((troopId) => {
      const count = troopCounts[Number(troopId)];
      const balance = getBalance(owner_entity, Number(troopId), currentDefaultTick, dojo.setup.components).balance;
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

    if (!army?.isHome) {
      canCreate = false;
    }

    setCanCreate(canCreate);
  }, [troopCounts]);

  const troops = [
    {
      name: ResourcesIds.Crossbowman,
      current: currencyFormat(Number(army?.troops.crossbowman_count || 0), 0),
    },
    {
      name: ResourcesIds.Knight,
      current: currencyFormat(Number(army?.troops.knight_count || 0), 0),
    },
    {
      name: ResourcesIds.Paladin,
      current: currencyFormat(Number(army?.troops.paladin_count || 0), 0),
    },
  ];

  return (
    army && (
      <>
        <div className="flex justify-between   p-2 text-xs">
          <div className="self-center flex flex-row mr-auto px-3 font-bold items-center gap-x-1">
            {army.isHome ? <span className="text-green">At Base</span> : armyPosition ? `On Map` : "Unknown"}
            <ViewOnMapIcon position={new PositionInterface(armyPosition)} />
          </div>
        </div>
        <div className="flex flex-col relative  p-2">
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
              ⚠️ Maximum troops per attacking army is {formatStringNumber(formatNumber(maxTroopCountPerArmy, 0))}
            </div>
          )}

          <div className="grid grid-cols-3 gap-3 my-4">
            {troops.map((troop) => {
              const balance = getBalance(owner_entity, troop.name, currentDefaultTick, dojo.setup.components).balance;

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
                      max={divideByPrecision(balance)}
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
            {army.isHome ? "Reinforce army" : "Must be at Base to Reinforce"}
          </Button>
        </div>
      </>
    )
  );
};

export const ViewOnMapIcon = ({
  position,
  hideTooltip = false,
  className,
}: {
  position: PositionInterface;
  hideTooltip?: boolean;
  className?: string;
}) => {
  const setTooltip = useUIStore((state) => state.setTooltip);
  const navigateToMapView = useNavigateToMapView();

  return (
    <Map
      className={clsx(
        "h-5 w-5 fill-gold hover:fill-gold/50 hover:animate-pulse duration-300 transition-all",
        className,
      )}
      onClick={() => {
        setTooltip(null);
        navigateToMapView(position);
      }}
      onMouseEnter={() => {
        if (hideTooltip) return;
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
