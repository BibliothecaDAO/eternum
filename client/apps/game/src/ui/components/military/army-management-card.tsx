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
import { currencyFormat, formatNumber, formatStringNumber } from "@/ui/utils/utils";
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
  TroopType,
} from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import clsx from "clsx";
import { useEffect, useState } from "react";

const troopTypeToResourcesId = {
  [TroopType.Crossbowman]: ResourcesIds.Crossbowman,
  [TroopType.Knight]: ResourcesIds.Knight,
  [TroopType.Paladin]: ResourcesIds.Paladin,
};

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

  const armyManager = new ArmyManager(dojo.setup.network.provider, dojo.setup.components, army?.entityId || 0);

  const isDefendingArmy = Boolean(army?.protectee);

  const [confirmDelete, setConfirmDelete] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [canCreate, setCanCreate] = useState(false);

  // TODO: Clean this up
  const armyPosition = { x: Number(army?.position.x || 0), y: Number(army?.position.y || 0) };

  const [editName, setEditName] = useState(false);
  const [naming, setNaming] = useState("");

  const [troopCount, setTroopCount] = useState<number>(0);
  const [selectedTroopType, setSelectedTroopType] = useState<TroopType | null>(
    army?.troops.count === 0 ? TroopType.Crossbowman : (army?.troops.type ?? null),
  );
  const [selectedTier, setSelectedTier] = useState<number>(1);

  const handleTroopCountChange = (count: number) => {
    setTroopCount(count);
  };

  const handleTierChange = (tier: number) => {
    if (army?.troops.count === 0) {
      setSelectedTier(tier);
    }
  };

  const handleDeleteArmy = async () => {
    setIsLoading(true);

    try {
      await armyManager.deleteArmy(account, army?.entityId || 0);
      setSelectedEntity && setSelectedEntity(null);
    } catch (e) {
      console.error(e);
    }
    setIsLoading(false);
  };

  const handleBuyArmy = async () => {
    if (!selectedTroopType) return;

    setIsLoading(true);
    const troops = {
      [ResourcesIds.Knight]: 0,
      [ResourcesIds.Crossbowman]: 0,
      [ResourcesIds.Paladin]: 0,
      [troopTypeToResourcesId[selectedTroopType]]: multiplyByPrecision(troopCount),
    };

    armyManager.addTroops(account, troops);

    setTroopCount(0);
    setIsLoading(false);
  };

  useEffect(() => {
    let canCreate = true;

    if (selectedTroopType) {
      const balance = getBalance(
        owner_entity,
        troopTypeToResourcesId[selectedTroopType],
        currentDefaultTick,
        dojo.setup.components,
      ).balance;
      if (troopCount > balance) {
        canCreate = false;
      }
    }

    if (troopCount === 0 || !selectedTroopType) {
      canCreate = false;
    }

    if (!army?.isHome) {
      canCreate = false;
    }

    setCanCreate(canCreate);
  }, [troopCount, selectedTroopType, army?.isHome]);

  const troops = [
    {
      name: ResourcesIds.Crossbowman,
      current: army?.troops.type === TroopType.Crossbowman ? currencyFormat(Number(army?.troops.count || 0), 0) : 0,
    },
    {
      name: ResourcesIds.Knight,
      current: army?.troops.type === TroopType.Knight ? currencyFormat(Number(army?.troops.count || 0), 0) : 0,
    },
    {
      name: ResourcesIds.Paladin,
      current: army?.troops.type === TroopType.Paladin ? currencyFormat(Number(army?.troops.count || 0), 0) : 0,
    },
  ].filter((troop) => {
    // If army has no troops, show all troop types
    if (army?.troops.count === 0) return true;
    // If army has troops, only show the current troop type
    return troopTypeToResourcesId[army?.troops.type ?? TroopType.Crossbowman] === troop.name;
  });

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
                      await provider.set_entity_name({ signer: account, entity_id: army.entityId, name: naming });
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

          {army.troops.count === 0 && (
            <div className="flex justify-center gap-2 mb-4">
              {[1, 2, 3].map((tier) => (
                <Button
                  key={tier}
                  variant={selectedTier === tier ? "primarySelected" : "primary"}
                  onClick={() => handleTierChange(tier)}
                >
                  Tier {tier}
                </Button>
              ))}
            </div>
          )}

          <div className={clsx("grid gap-3 my-4", troops.length === 1 ? "grid-cols-1" : "grid-cols-3")}>
            {troops.map((troop) => {
              const balance = getBalance(owner_entity, troop.name, currentDefaultTick, dojo.setup.components).balance;
              const isCurrentTroopType =
                army.troops.count === 0
                  ? selectedTroopType ===
                    Object.entries(troopTypeToResourcesId).find(([_, id]) => id === troop.name)?.[0]
                  : troopTypeToResourcesId[army.troops.type] === troop.name;

              return (
                <div
                  className={clsx(
                    "p-2 bg-gold/10 flex flex-col cursor-pointer",
                    isCurrentTroopType ? "ring-2 ring-gold" : "opacity-50",
                  )}
                  key={troop.name}
                  onClick={() => {
                    if (army.troops.count === 0) {
                      const troopType = Object.entries(troopTypeToResourcesId).find(
                        ([_, id]) => id === troop.name,
                      )?.[0] as TroopType;
                      setSelectedTroopType(troopType);
                    }
                  }}
                >
                  <div className="font-bold mb-4">
                    <div className="flex justify-between">
                      <div className="text-md">{ResourcesIds[troop.name]}</div>
                    </div>
                    <div className="px-2 py-1 bg-white/10  flex justify-between">
                      <ResourceIcon withTooltip={false} resource={ResourcesIds[troop.name]} size="lg" />
                      <div className="text-green self-center">x {troop.current}</div>
                    </div>
                  </div>

                  {isCurrentTroopType && (
                    <div className="flex items-center mt-auto flex-col">
                      <div className="px-2 text-xs font-bold mb-3">
                        Avail. [{currencyFormat(balance ? Number(balance) : 0, 0)}]
                      </div>
                      <NumberInput
                        max={divideByPrecision(balance)}
                        min={0}
                        step={100}
                        value={troopCount}
                        onChange={handleTroopCountChange}
                      />
                    </div>
                  )}
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
