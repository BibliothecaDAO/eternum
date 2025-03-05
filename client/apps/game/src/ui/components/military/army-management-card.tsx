import { ReactComponent as Pen } from "@/assets/icons/common/pen.svg";
import { ReactComponent as Map } from "@/assets/icons/common/world.svg";
import { useNavigateToMapView } from "@/hooks/helpers/use-navigate";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { Position as PositionInterface } from "@/types/position";
import Button from "@/ui/elements/button";
import { NumberInput } from "@/ui/elements/number-input";
import { ResourceIcon } from "@/ui/elements/resource-icon";
import TextInput from "@/ui/elements/text-input";
import { currencyFormat } from "@/ui/utils/utils";
import { getBlockTimestamp } from "@/utils/timestamp";
import {
  ArmyInfo,
  ArmyManager,
  Direction,
  divideByPrecision,
  getBalance,
  getTroopResourceId,
  ID,
  resources,
  TroopTier,
  TroopType,
} from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import clsx from "clsx";
import { useEffect, useState } from "react";

type ArmyManagementCardProps = {
  owner_entity: ID;
  army: ArmyInfo | undefined;
  setSelectedEntity?: (entity: ArmyInfo | null) => void;
};

type ArmyCreateProps = {
  owner_entity: ID;
  army: ArmyInfo | undefined;
  armyManager: ArmyManager;
  isExplorer: boolean;
  guardSlot?: number;
  onCancel?: () => void;
};

export const ArmyCreate = ({ owner_entity, army, armyManager, isExplorer, guardSlot, onCancel }: ArmyCreateProps) => {
  const {
    setup: { components },
    account: { account },
  } = useDojo();

  const currentDefaultTick = getBlockTimestamp().currentDefaultTick;
  // const maxTroopCountPerArmy = configManager.getTroopConfig().troop_limit_config.explorer_guard_max_troop_count;

  const [isLoading, setIsLoading] = useState(false);
  const [canCreate, setCanCreate] = useState(false);
  const [troopCount, setTroopCount] = useState<number>(0);
  const [selectedTroopType, setSelectedTroopType] = useState<TroopType>(
    army
      ? army.troops.count === 0n
        ? TroopType.Crossbowman
        : (army.troops.category as TroopType)
      : TroopType.Crossbowman,
  );
  const [selectedTier, setSelectedTier] = useState<TroopTier>(TroopTier.T1);

  const handleTroopCountChange = (count: number) => {
    setTroopCount(count);
  };

  const handleTierChange = (tier: TroopTier) => {
    setSelectedTier(tier);
  };

  const handleBuyArmy = async (isExplorer: boolean, troopType: TroopType, troopTier: TroopTier, troopCount: number) => {
    setIsLoading(true);

    if (isExplorer) {
      if (army) {
        if (army.isHome) {
          await armyManager.addTroopsToExplorer(account, army.entityId, troopType, troopTier, troopCount);
        }
      } else {
        await armyManager.createExplorerArmy(account, troopType, troopTier, troopCount, Direction.NORTH_EAST);
      }
    } else {
      if (guardSlot !== undefined) {
        await armyManager.addTroopsToGuard(account, troopType, troopTier, troopCount, guardSlot);
      }
    }

    setTroopCount(0);
    setIsLoading(false);
  };

  useEffect(() => {
    let canCreate = true;

    const resourceId = getTroopResourceId(selectedTroopType, selectedTier);
    console.log("resourceId", resourceId);
    const balance = getBalance(owner_entity, resourceId, currentDefaultTick, components).balance;

    if (troopCount > balance) {
      canCreate = false;
    }

    if (troopCount === 0) {
      canCreate = false;
    }

    if (isExplorer && army && !army.isHome) {
      canCreate = false;
    }

    setCanCreate(canCreate);
  }, [troopCount, selectedTroopType, army?.isHome, owner_entity, currentDefaultTick, components, isExplorer]);

  const troops = [
    {
      troopType: TroopType.Crossbowman,
      current: army?.troops.category === TroopType.Crossbowman ? currencyFormat(Number(army?.troops.count || 0), 0) : 0,
    },
    {
      troopType: TroopType.Knight,
      current: army?.troops.category === TroopType.Knight ? currencyFormat(Number(army?.troops.count || 0), 0) : 0,
    },
    {
      troopType: TroopType.Paladin,
      current: army?.troops.category === TroopType.Paladin ? currencyFormat(Number(army?.troops.count || 0), 0) : 0,
    },
  ].filter((troop) => {
    // If no army or army has no troops, show all troop types
    if (!army || army.troops.count === 0n) return true;
    // If army has troops, only show the current troop type
    return army.troops.category === troop.troopType;
  });

  return (
    <>
      {/* {isExplorer && (
        <div className="text-xs text-yellow-500 mb-2">
          ⚠️ Maximum troops per attacking army is {formatStringNumber(formatNumber(maxTroopCountPerArmy, 0))}
        </div>
      )} */}

      {(!army || army.troops.count === 0n) && (
        <div className="flex justify-center gap-2 mb-4">
          {[TroopTier.T1, TroopTier.T2, TroopTier.T3].map((tier) => (
            <Button
              key={tier}
              variant={selectedTier === tier ? "primarySelected" : "primary"}
              onClick={() => handleTierChange(tier)}
            >
              {tier}
            </Button>
          ))}
        </div>
      )}

      <div className={clsx("grid gap-3 my-4", troops.length === 1 ? "grid-cols-1" : "grid-cols-3")}>
        {troops.map((troop) => {
          const balance = getBalance(
            owner_entity,
            getTroopResourceId(troop.troopType, selectedTier),
            currentDefaultTick,
            components,
          ).balance;
          const isCurrentTroopType =
            !army || army.troops.count === 0n
              ? selectedTroopType === troop.troopType
              : army.troops.category === troop.troopType;

          return (
            <div
              className={clsx(
                "p-2 bg-gold/10 flex flex-col cursor-pointer",
                isCurrentTroopType ? "ring-2 ring-gold" : "opacity-50",
              )}
              key={troop.troopType}
              onClick={() => {
                if (!army || army.troops.count === 0n) {
                  setSelectedTroopType(troop.troopType);
                }
              }}
            >
              <div className="font-bold mb-4">
                <div className="flex justify-between">
                  <div className="text-md">{TroopType[troop.troopType]}</div>
                </div>
                <div className="px-2 py-1 bg-white/10  flex justify-between">
                  <ResourceIcon
                    withTooltip={false}
                    resource={
                      resources.find((resource) => resource.id === getTroopResourceId(troop.troopType, selectedTier))
                        ?.trait || ""
                    }
                    size="lg"
                  />
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

      <div className="flex justify-center gap-2 w-full">
        <Button
          className={onCancel ? "w-1/2" : "w-full"}
          disabled={!canCreate}
          variant="primary"
          isLoading={isLoading}
          onClick={() =>
            handleBuyArmy(isExplorer, selectedTroopType, selectedTier, troopCount).finally(() => {
              setTroopCount(0);
              setIsLoading(false);
              onCancel?.();
            })
          }
        >
          {isExplorer
            ? army
              ? army.isHome
                ? "Reinforce army"
                : "Must be at Base to Reinforce"
              : "Create Army"
            : army
              ? "Add Troops"
              : "Add Defense"}
        </Button>
        {onCancel && (
          <Button variant="secondary" className="w-1/2" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </>
  );
};

// TODO Unify this. Push all useComponentValues up to the top level
export const ArmyManagementCard = ({ owner_entity, army, setSelectedEntity }: ArmyManagementCardProps) => {
  const {
    account: { account },
    network: { provider },
  } = useDojo();

  const dojo = useDojo();

  const armyManager = new ArmyManager(dojo.setup.network.provider, dojo.setup.components, army?.entityId || 0);

  const [isLoading, setIsLoading] = useState(false);

  // TODO: Clean this up
  const armyPosition = { x: Number(army?.position.x || 0), y: Number(army?.position.y || 0) };

  const [editName, setEditName] = useState(false);
  const [naming, setNaming] = useState("");

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
          </div>

          <ArmyCreate owner_entity={owner_entity} army={army} armyManager={armyManager} isExplorer={true} />
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
