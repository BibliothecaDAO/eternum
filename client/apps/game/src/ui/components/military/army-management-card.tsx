import { sqlApi } from "@/services/api";
import { Position as PositionInterface } from "@/types/position";
import Button from "@/ui/elements/button";
import { LoadingAnimation } from "@/ui/elements/loading-animation";
import { NumberInput } from "@/ui/elements/number-input";
import { ResourceIcon } from "@/ui/elements/resource-icon";
import TextInput from "@/ui/elements/text-input";
import { ViewOnMapIcon } from "@/ui/elements/view-on-map-icon";
import { currencyFormat } from "@/ui/utils/utils";
import { getBlockTimestamp } from "@/utils/timestamp";
import {
  ArmyManager,
  divideByPrecision,
  getBalance,
  getEntityIdFromKeys,
  getTroopName,
  getTroopResourceId,
} from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import {
  ArmyInfo,
  Direction,
  getDirectionBetweenAdjacentHexes,
  getNeighborHexes,
  ID,
  resources,
  TroopTier,
  TroopType,
} from "@bibliothecadao/types";
import { getComponentValue } from "@dojoengine/recs";
import clsx from "clsx";
import { LockIcon, Pen } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

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

interface DirectionButtonProps {
  direction: Direction;
  label: string;
  tooltip: string;
  availableDirections: Direction[];
  selectedDirection: Direction | null;
  onClick: (direction: Direction) => void;
}

const DirectionButton: React.FC<DirectionButtonProps> = ({
  direction,
  label,
  tooltip,
  availableDirections,
  selectedDirection,
  onClick,
}) => {
  const isAvailable = availableDirections.includes(direction);
  const isSelected = selectedDirection === direction;

  return (
    <Button
      variant={isSelected ? "gold" : isAvailable ? "default" : "outline"}
      size="md"
      onClick={() => isAvailable && onClick(direction)}
      disabled={!isAvailable}
      className={`aspect-square text-sm ${isAvailable ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}
      title={tooltip}
    >
      {label}
    </Button>
  );
};

export const ArmyCreate = ({ owner_entity, army, armyManager, isExplorer, guardSlot, onCancel }: ArmyCreateProps) => {
  const {
    setup: { components },
    account: { account },
  } = useDojo();

  const currentDefaultTick = getBlockTimestamp().currentDefaultTick;

  const [isLoading, setIsLoading] = useState(false);
  const [canCreate, setCanCreate] = useState(false);
  const [troopCount, setTroopCount] = useState<number>(0);
  const [freeDirections, setFreeDirections] = useState<Direction[]>([]);
  const [selectedTroopType, setSelectedTroopType] = useState<TroopType>(
    army
      ? army.troops.count === 0n
        ? TroopType.Crossbowman
        : (army.troops.category as TroopType)
      : TroopType.Crossbowman,
  );
  const [selectedTier, setSelectedTier] = useState<TroopTier>(
    army && army.troops.count > 0n ? (army.troops.tier as TroopTier) : TroopTier.T1,
  );
  const [selectedDirection, setSelectedDirection] = useState<Direction | null>(null);
  const [isLoadingTiles, setIsLoadingTiles] = useState(true);
  const [activeTab, setActiveTab] = useState<"troops" | "direction">("troops");

  const handleTroopCountChange = (count: number) => {
    setTroopCount(count);
  };

  const handleTierChange = (tier: TroopTier) => {
    setSelectedTier(tier);
  };

  useEffect(() => {
    const fetchTiles = async () => {
      setIsLoadingTiles(true);
      const structure = getComponentValue(components.Structure, getEntityIdFromKeys([BigInt(owner_entity)]));
      if (structure) {
        const coords = getNeighborHexes(structure.base.coord_x, structure.base.coord_y);
        const tiles = await sqlApi.fetchTilesByCoords(coords.map((coord) => ({ col: coord.col, row: coord.row })));
        const freeTiles = tiles.filter((tile) => tile.occupier_id === 0);
        const freeDirections = freeTiles.map((tile) =>
          getDirectionBetweenAdjacentHexes(
            { col: structure.base.coord_x, row: structure.base.coord_y },
            { col: tile.col, row: tile.row },
          ),
        );
        setFreeDirections(freeDirections.filter((direction) => direction !== null) as Direction[]);
      }
      setIsLoadingTiles(false);
    };
    fetchTiles();
  }, []);

  useEffect(() => {
    if (freeDirections.length > 0) {
      setSelectedDirection(freeDirections[0]);
    }
  }, [freeDirections]);

  const handleBuyArmy = async (isExplorer: boolean, troopType: TroopType, troopTier: TroopTier, troopCount: number) => {
    setIsLoading(true);

    const homeDirection =
      army?.position && army?.structure
        ? getDirectionBetweenAdjacentHexes(
            { col: army.position.x, row: army.position.y },
            { col: army.structure.base.coord_x, row: army.structure.base.coord_y },
          )
        : null;

    if (isExplorer) {
      if (army) {
        if (army.isHome && homeDirection !== null) {
          await armyManager.addTroopsToExplorer(
            account,
            army.entityId,
            troopType,
            troopTier,
            troopCount,
            homeDirection,
          );
        }
      } else {
        if (selectedDirection === null) {
          console.error("No direction selected");
          setIsLoading(false);
          return;
        }
        await armyManager.createExplorerArmy(account, troopType, troopTier, troopCount, selectedDirection);
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

    if (isExplorer && freeDirections.length === 0) {
      canCreate = false;
    }

    setCanCreate(canCreate);
  }, [
    troopCount,
    selectedTroopType,
    selectedTier,
    army?.isHome,
    owner_entity,
    currentDefaultTick,
    components,
    isExplorer,
    freeDirections.length,
  ]);

  const getMaxAffordableTroops = useMemo(() => {
    const resourceId = getTroopResourceId(selectedTroopType, selectedTier);
    const balance = getBalance(owner_entity, resourceId, currentDefaultTick, components).balance;
    return divideByPrecision(balance);
  }, [owner_entity, selectedTroopType, selectedTier, currentDefaultTick, components]);

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
    <div className="">
      {isExplorer && !army && freeDirections.length === 0 && !isLoadingTiles && (
        <div className="text-xs text-red-500 mb-4 p-2 bg-red-500/10 border border-red-500/30  flex items-center">
          <span className="mr-1">⚠️</span> No space available to create an army. Clear adjacent tiles to create an army.
        </div>
      )}

      {isExplorer && army && !army.isHome && (
        <div className="text-xs p-2 bg-amber-500/10 flex items-center">
          <span className="mr-1">⚠️</span> Army must be at Base to add reinforcements.
        </div>
      )}

      {isExplorer && !army && (
        <div className="flex border-b border-gold/30 mb-4">
          <button
            className={`flex-1 py-2 px-4 text-center ${
              activeTab === "troops" ? "bg-gold/20 text-gold" : "text-gold/50 hover:text-gold"
            }`}
            onClick={() => setActiveTab("troops")}
          >
            Select Troops
          </button>
          <button
            className={`flex-1 py-2 px-4 text-center ${
              activeTab === "direction" ? "bg-gold/20 text-gold" : "text-gold/50 hover:text-gold"
            }`}
            onClick={() => setActiveTab("direction")}
          >
            Spawn Location
          </button>
        </div>
      )}

      {activeTab === "troops" && (
        <>
          {(!army || army.troops.count === 0n) && (
            <div className="my-4">
              <h6 className="text-center mb-2">SELECT TIER</h6>
              <div className="flex justify-center gap-2 mb-2">
                {[TroopTier.T1, TroopTier.T2, TroopTier.T3].map((tier) => (
                  <Button
                    key={tier}
                    variant={selectedTier === tier ? "gold" : "primary"}
                    onClick={() => handleTierChange(tier)}
                    className={clsx(
                      "px-3 py-1",
                      selectedTier === tier ? "ring-2 ring-gold" : "opacity-80 hover:opacity-100",
                    )}
                  >
                    Tier {tier}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="mb-4">
            <h5 className="text-center my-4">SELECT TROOP TYPE</h5>
            <div className={clsx("grid gap-3", troops.length === 1 ? "grid-cols-1" : "grid-cols-3")}>
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
                      "p-3 bg-gold/5 flex flex-col cursor-pointer transition-all duration-200",
                      isCurrentTroopType ? "panel-gold" : "opacity-50 hover:opacity-70",
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
                        <h6 className=" font-semibold">{getTroopName(troop.troopType, selectedTier)}</h6>
                      </div>
                      <div className="text-xl font-normal mt-1 mb-2 text-gold/80">
                        Avail. <span className="text-gold">{currencyFormat(balance ? Number(balance) : 0, 0)}</span>
                      </div>
                      <div className="px-2 py-1 bg-white/10 flex justify-between items-center rounded-md">
                        <ResourceIcon
                          withTooltip={false}
                          resource={
                            resources.find(
                              (resource) => resource.id === getTroopResourceId(troop.troopType, selectedTier),
                            )?.trait || ""
                          }
                          size="lg"
                        />
                        <div className="text-green self-center font-bold">x {troop.current}</div>
                      </div>
                    </div>

                    {isCurrentTroopType && (
                      <div className="mt-auto">
                        <div className="flex justify-between items-center gap-2 mb-2">
                          <button
                            className="text-xs bg-gold/20 hover:bg-gold/30 px-2 py-1 rounded w-1/2"
                            onClick={(e) => {
                              e.stopPropagation();
                              setTroopCount((count) => Math.min(count + 500, getMaxAffordableTroops));
                            }}
                          >
                            +500
                          </button>
                          <button
                            className="text-xs bg-gold/20 hover:bg-gold/30 px-2 py-1 rounded w-1/2"
                            onClick={(e) => {
                              e.stopPropagation();
                              setTroopCount(getMaxAffordableTroops);
                            }}
                          >
                            MAX
                          </button>
                        </div>
                        <NumberInput
                          max={divideByPrecision(balance)}
                          min={0}
                          step={100}
                          value={troopCount}
                          onChange={handleTroopCountChange}
                          className="border border-gold/30"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {activeTab === "direction" && isExplorer && !army && (
        <div className="mb-4">
          <h6 className="text-center mb-2">SELECT DIRECTION</h6>
          {isLoadingTiles ? (
            <LoadingAnimation />
          ) : freeDirections.length > 0 ? (
            <div className="grid grid-cols-3 gap-2 mx-auto my-4 max-w-xs">
              <DirectionButton
                direction={Direction.SOUTH_WEST}
                label="↖"
                tooltip="North West"
                availableDirections={freeDirections}
                selectedDirection={selectedDirection}
                onClick={setSelectedDirection}
              />
              <div />
              <DirectionButton
                direction={Direction.SOUTH_EAST}
                label="↗"
                tooltip="North East"
                availableDirections={freeDirections}
                selectedDirection={selectedDirection}
                onClick={setSelectedDirection}
              />
              <DirectionButton
                direction={Direction.WEST}
                label="←"
                tooltip="West"
                availableDirections={freeDirections}
                selectedDirection={selectedDirection}
                onClick={setSelectedDirection}
              />
              <div className="flex items-center justify-center text-4xl ">🏰</div>
              <DirectionButton
                direction={Direction.EAST}
                label="→"
                tooltip="East"
                availableDirections={freeDirections}
                selectedDirection={selectedDirection}
                onClick={setSelectedDirection}
              />
              <DirectionButton
                direction={Direction.NORTH_WEST}
                label="↙"
                tooltip="South West"
                availableDirections={freeDirections}
                selectedDirection={selectedDirection}
                onClick={setSelectedDirection}
              />
              <div />
              <DirectionButton
                direction={Direction.NORTH_EAST}
                label="↘"
                tooltip="South East"
                availableDirections={freeDirections}
                selectedDirection={selectedDirection}
                onClick={setSelectedDirection}
              />
            </div>
          ) : null}
        </div>
      )}

      <div className="flex justify-center gap-2 w-full mt-6">
        <Button
          className={clsx(onCancel ? "w-1/2" : "w-full", !canCreate && "opacity-50 cursor-not-allowed")}
          disabled={!canCreate}
          variant="gold"
          isLoading={isLoading}
          onClick={() =>
            handleBuyArmy(isExplorer, selectedTroopType, selectedTier, troopCount).finally(() => {
              setTroopCount(0);
              setIsLoading(false);
              onCancel?.();
            })
          }
        >
          {isExplorer ? (
            army ? (
              army.isHome ? (
                "Reinforce Army"
              ) : (
                <div className="flex items-center justify-center">
                  <LockIcon className="w-3 h-3 mr-1" /> Must be at Base
                </div>
              )
            ) : (
              "Create Army"
            )
          ) : army ? (
            "Add Troops"
          ) : (
            "Add Defense"
          )}
        </Button>
        {onCancel && (
          <Button isLoading={isLoading} variant="secondary" className="w-1/2" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
};

// TODO Unify this. Push all useComponentValues up to the top level
export const ArmyManagementCard = ({ owner_entity, army, setSelectedEntity }: ArmyManagementCardProps) => {
  const {
    account: { account },
    network: { provider },
  } = useDojo();

  const dojo = useDojo();

  const armyManager = new ArmyManager(dojo.setup.systemCalls, dojo.setup.components, army?.entityId || 0);

  const [isLoading, setIsLoading] = useState(false);

  const [editName, setEditName] = useState(false);
  const [naming, setNaming] = useState(army?.name || "");

  useEffect(() => {
    if (army?.name) {
      setNaming(army.name);
    }
  }, [army?.name]);

  return (
    army && (
      <div className=" overflow-hidden">
        <div className="flex justify-between">
          <div className="self-center flex flex-row gap-3 mt-4 items-center">
            {army.isHome ? (
              <span className="text-green flex items-center">
                <span className="w-2 h-2 bg-green rounded-full mr-1"></span>
                At Base
              </span>
            ) : army.position ? (
              <h6 className=" flex items-center">Army On Map</h6>
            ) : (
              "Unknown"
            )}
            <ViewOnMapIcon position={new PositionInterface(army.position)} />
          </div>
        </div>
        <div className="flex flex-col relative my-4">
          <div className="flex justify-between items-center">
            {editName ? (
              <div className="flex space-x-2 w-full items-center">
                <TextInput placeholder="Type Name" className="h-full flex-1" onChange={(name) => setNaming(name)} />
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
                  Save
                </Button>
                <Button
                  variant="secondary"
                  className="!p-1"
                  onClick={() => {
                    setEditName(false);
                    setNaming("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex flex-row items-center w-full">
                <h3>{army.name || "Unnamed Army"}</h3>
                <button
                  className="ml-2 p-1.5 rounded-full hover:bg-gold/20 transition-colors"
                  onClick={() => {
                    setNaming(army.name || "");
                    setEditName(true);
                  }}
                >
                  <Pen className="w-4 h-4 fill-gold" />
                </button>
              </div>
            )}
          </div>

          <ArmyCreate owner_entity={owner_entity} army={army} armyManager={armyManager} isExplorer={true} />
        </div>
      </div>
    )
  );
};
