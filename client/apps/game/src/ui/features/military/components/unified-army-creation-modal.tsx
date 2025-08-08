import { sqlApi } from "@/services/api";
import Button from "@/ui/design-system/atoms/button";
import { NumberInput } from "@/ui/design-system/atoms/number-input";
import { LoadingAnimation } from "@/ui/design-system/molecules/loading-animation";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { ModalContainer } from "@/ui/shared/components/modal-container";
import { getTierStyle } from "@/ui/utils/tier-styles";
import { getBlockTimestamp } from "@/utils/timestamp";
import {
  ArmyManager,
  divideByPrecision,
  getBalance,
  getEntityIdFromKeys,
  getTroopResourceId,
} from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import {
  DEFENSE_NAMES,
  Direction,
  getDirectionBetweenAdjacentHexes,
  getNeighborHexes,
  resources,
  TroopTier,
  TroopType,
} from "@bibliothecadao/types";
import { getComponentValue } from "@dojoengine/recs";
import clsx from "clsx";
import { AlertTriangle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const DirectionButton = ({
  direction,
  label,
  availableDirections,
  selectedDirection,
  onClick,
}: {
  direction: Direction;
  label: string;
  availableDirections: Direction[];
  selectedDirection: Direction | null;
  onClick: (direction: Direction) => void;
}) => {
  const isAvailable = availableDirections.includes(direction);
  const isSelected = selectedDirection === direction;

  return (
    <Button
      variant={isSelected ? "gold" : isAvailable ? "outline" : "secondary"}
      size="md"
      onClick={() => isAvailable && onClick(direction)}
      disabled={!isAvailable}
      className={clsx(
        "aspect-square text-xl sm:text-2xl lg:text-3xl font-bold transition-all duration-200",
        "min-h-[48px] sm:min-h-[56px] lg:min-h-[64px]",
        "min-w-[48px] sm:min-w-[56px] lg:min-w-[64px]",
        isSelected
          ? "ring-2 ring-gold/60 shadow-lg shadow-gold/25 scale-105"
          : isAvailable
            ? "hover:bg-gold/15 hover:border-gold/60 hover:scale-105 hover:shadow-md cursor-pointer"
            : "cursor-not-allowed opacity-40",
      )}
    >
      {label}
    </Button>
  );
};

interface UnifiedArmyCreationModalProps {
  structureId: number;
  maxDefenseSlots?: number;
  isExplorer?: boolean;
  direction?: Direction;
}

export const UnifiedArmyCreationModal = ({
  structureId,
  maxDefenseSlots = 4,
  isExplorer = true,
  direction,
}: UnifiedArmyCreationModalProps) => {
  const dojo = useDojo();
  const {
    setup: { components },
    account: { account },
  } = dojo;

  const [isLoading, setIsLoading] = useState(false);
  const [freeDirections, setFreeDirections] = useState<Direction[]>([]);
  const [isLoadingDirections, setIsLoadingDirections] = useState(false);
  const [selectedDirection, setSelectedDirection] = useState<Direction | null>(
    direction !== undefined ? direction : null,
  );
  const [selectedTroopCombo, setSelectedTroopCombo] = useState<{ type: TroopType; tier: TroopTier }>({
    type: TroopType.Crossbowman,
    tier: TroopTier.T1,
  });
  const [troopCount, setTroopCount] = useState(0);
  const [guardSlot, setGuardSlot] = useState(0);
  const [armyType, setArmyType] = useState(isExplorer);
  const currentDefaultTick = getBlockTimestamp().currentDefaultTick;

  // Create army manager for the structure
  const armyManager = useMemo(() => {
    return new ArmyManager(dojo.setup.systemCalls, components, structureId);
  }, [structureId, components, dojo.setup.systemCalls]);

  // Auto-select the first troop with balance or fallback to first
  useEffect(() => {
    const troopTypes = [TroopType.Crossbowman, TroopType.Knight, TroopType.Paladin];
    const troopTiers = [TroopTier.T1, TroopTier.T2, TroopTier.T3];

    // Check all combinations and find first one with balance
    let firstTroopWithBalance: { type: TroopType; tier: TroopTier } | null = null;

    for (const type of troopTypes) {
      for (const tier of troopTiers) {
        const balance = getBalance(structureId, getTroopResourceId(type, tier), currentDefaultTick, components).balance;

        const available = Number(divideByPrecision(balance) || 0);

        if (available > 0 && !firstTroopWithBalance) {
          firstTroopWithBalance = { type, tier };
          break;
        }
      }
      if (firstTroopWithBalance) break;
    }

    // If we found a troop with balance, use it; otherwise keep the default
    if (firstTroopWithBalance) {
      setSelectedTroopCombo(firstTroopWithBalance);
    }
  }, [structureId, currentDefaultTick, components]);

  // Load available directions for explorer armies
  useEffect(() => {
    const fetchDirections = async () => {
      if (!armyType) return;

      setIsLoadingDirections(true);
      const structure = getComponentValue(components.Structure, getEntityIdFromKeys([BigInt(structureId)]));

      if (structure) {
        const coords = getNeighborHexes(structure.base.coord_x, structure.base.coord_y);
        const tiles = await sqlApi.fetchTilesByCoords(coords.map((coord) => ({ col: coord.col, row: coord.row })));
        const freeTiles = tiles.filter((tile) => tile.occupier_id === 0);
        const directions = freeTiles.map((tile) =>
          getDirectionBetweenAdjacentHexes(
            { col: structure.base.coord_x, row: structure.base.coord_y },
            { col: tile.col, row: tile.row },
          ),
        );
        setFreeDirections(directions.filter((direction) => direction !== null) as Direction[]);
      }
      setIsLoadingDirections(false);
    };

    fetchDirections();
  }, [structureId, armyType, components]);

  // Auto-select first available direction
  useEffect(() => {
    if (freeDirections.length > 0 && selectedDirection === null && direction === undefined) {
      setSelectedDirection(freeDirections[0]);
    }
  }, [freeDirections, selectedDirection, direction]);

  const handleCreate = async () => {
    if (!armyManager || troopCount <= 0) return;

    setIsLoading(true);

    try {
      if (armyType) {
        if (selectedDirection === null) {
          throw new Error("No direction selected");
        }
        await armyManager.createExplorerArmy(
          account,
          selectedTroopCombo.type,
          selectedTroopCombo.tier,
          troopCount,
          selectedDirection,
        );
      } else {
        await armyManager.addTroopsToGuard(
          account,
          selectedTroopCombo.type,
          selectedTroopCombo.tier,
          troopCount,
          guardSlot,
        );
      }

      // Success - army created
    } catch (error) {
      console.error("Failed to create army:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getMaxAffordable = () => {
    const resourceId = getTroopResourceId(selectedTroopCombo.type, selectedTroopCombo.tier);
    const balance = getBalance(structureId, resourceId, currentDefaultTick, components).balance;
    return divideByPrecision(balance);
  };

  const maxAffordable = getMaxAffordable();
  const troopResource = resources.find(
    (r) => r.id === getTroopResourceId(selectedTroopCombo.type, selectedTroopCombo.tier),
  );

  return (
    <ModalContainer title={armyType ? "Create Attack Army" : "Create Defense Army"} size="large">
      <div className="p-4 w-full h-full grid grid-cols-2 gap-4">
        {/* LEFT HALF: Troop Selection */}
        <div className="flex flex-col h-full">
          {/* Troop Selection Grid */}
          <div className="flex-1 flex flex-col justify-center">
            <h6 className="text-center mb-3 text-gold text-base font-bold">SELECT TROOP</h6>
            <div className="grid grid-cols-3 gap-2">
              {[TroopType.Crossbowman, TroopType.Knight, TroopType.Paladin].map((type) => (
                <div key={type} className="space-y-1.5">
                  <div className="text-center text-gold/80 text-xs font-semibold uppercase tracking-wide">
                    {type === TroopType.Crossbowman ? "CROSSBOW" : type}
                  </div>
                  {[TroopTier.T1, TroopTier.T2, TroopTier.T3].map((tier) => {
                    const balance = getBalance(
                      structureId,
                      getTroopResourceId(type, tier),
                      currentDefaultTick,
                      components,
                    ).balance;

                    const isSelected = selectedTroopCombo.type === type && selectedTroopCombo.tier === tier;
                    const troopResourceForCard = resources.find((r) => r.id === getTroopResourceId(type, tier));
                    const available = Number(divideByPrecision(balance) || 0);

                    return (
                      <div
                        key={`${type}-${tier}`}
                        className={clsx(
                          "p-2 flex flex-col cursor-pointer transition-all duration-200 rounded-lg border relative group",
                          isSelected
                            ? "border-gold bg-gold/20 ring-2 ring-gold/60 shadow-lg shadow-gold/25"
                            : available > 0
                              ? "border-brown/50 bg-brown/10 hover:border-gold/60 hover:bg-gold/12 hover:shadow-md"
                              : "border-gray/30 bg-gray/5 opacity-40 cursor-not-allowed",
                        )}
                        onClick={() => available > 0 && setSelectedTroopCombo({ type, tier })}
                      >
                        {/* Tier Badge */}
                        <div className="absolute -top-0.5 -right-0.5">
                          <div
                            className={clsx(
                              "w-4 h-4 rounded-full flex items-center justify-center text-xxs font-bold border shadow-sm",
                              available > 0 ? getTierStyle(`T${tier}`) : "bg-gray/50 text-gray-400 border-gray-400",
                            )}
                          >
                            {tier}
                          </div>
                        </div>

                        {/* Resource Icon */}
                        <div className="flex items-center justify-center p-1.5 bg-dark-brown/40 rounded mb-1.5">
                          <ResourceIcon resource={troopResourceForCard?.trait || ""} size="sm" withTooltip={false} />
                        </div>

                        {/* Available Count */}
                        <div
                          className={clsx(
                            "text-center text-xs font-bold",
                            isSelected ? "text-gold" : available > 0 ? "text-gold/90" : "text-gray-400",
                          )}
                        >
                          {available > 0 ? (available > 999 ? `${Math.floor(available / 1000)}k` : available) : "0"}
                        </div>
                        <div className="text-center text-xxs text-gold/60 mt-0.5">available</div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Troop Count */}
          <div className="mt-4">
            <h6 className="text-center mb-2 text-gold text-base font-bold">TROOP COUNT</h6>
            <div className="flex justify-center gap-2 mb-2">
              <Button
                variant="outline"
                size="xs"
                onClick={() => setTroopCount(Math.min(troopCount + 100, maxAffordable))}
                disabled={troopCount >= maxAffordable}
                className="px-3"
              >
                +100
              </Button>
              <Button
                variant="outline"
                size="xs"
                onClick={() => setTroopCount(Math.min(troopCount + 500, maxAffordable))}
                disabled={troopCount >= maxAffordable}
                className="px-3"
              >
                +500
              </Button>
              <Button
                variant="gold"
                size="xs"
                onClick={() => setTroopCount(maxAffordable)}
                disabled={troopCount >= maxAffordable}
                className="px-4 font-bold"
              >
                MAX
              </Button>
            </div>
            <NumberInput
              max={maxAffordable}
              min={0}
              step={100}
              value={troopCount}
              onChange={setTroopCount}
              className="border border-gold/50 text-center text-base bg-dark-brown/30 focus:border-gold focus:ring-2 focus:ring-gold/50"
            />
            <div className="text-xs text-gold/70 text-center mt-1.5">Max: {maxAffordable.toLocaleString()}</div>
          </div>

          {/* Resource Validation */}
          {troopCount > maxAffordable && (
            <div className="bg-red/10 border border-red/40 rounded-lg p-2.5 mt-3">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4 text-red" />
                <span className="text-red font-semibold text-sm">Insufficient Resources</span>
              </div>
              <p className="text-xs text-red/90">
                Need {troopCount.toLocaleString()}, have {maxAffordable.toLocaleString()}
              </p>
            </div>
          )}
        </div>

        {/* RIGHT HALF: Army Type + Direction/Defense */}
        <div className="flex flex-col h-full">
          {/* Army Type Toggle */}
          <div className="mb-4">
            <div className="flex gap-2">
              <Button
                variant={armyType ? "gold" : "outline"}
                onClick={() => setArmyType(true)}
                size="md"
                className={clsx(
                  "flex-1 py-3 font-bold transition-all duration-200",
                  armyType ? "ring-2 ring-gold/50 shadow-lg shadow-gold/20" : "hover:bg-gold/10",
                )}
              >
                ATTACK
              </Button>
              <Button
                variant={!armyType ? "gold" : "outline"}
                onClick={() => setArmyType(false)}
                size="md"
                className={clsx(
                  "flex-1 py-3 font-bold transition-all duration-200",
                  !armyType ? "ring-2 ring-gold/50 shadow-lg shadow-gold/20" : "hover:bg-gold/10",
                )}
              >
                DEFENSE
              </Button>
            </div>
          </div>

          {/* Defense Slot Selection */}
          {!armyType && (
            <div className="flex-1 flex flex-col justify-center mb-4">
              <h6 className="text-center mb-3 text-gold text-base font-bold">DEFENSE SLOT</h6>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(DEFENSE_NAMES).map(([slotIndex, slotName]) => {
                  const slot = parseInt(slotIndex);
                  const isSelected = guardSlot === slot;
                  const isSlotAvailable = slot < maxDefenseSlots;

                  return (
                    <Button
                      key={slot}
                      variant={isSelected ? "gold" : isSlotAvailable ? "outline" : "secondary"}
                      onClick={() => isSlotAvailable && setGuardSlot(slot)}
                      disabled={!isSlotAvailable}
                      size="md"
                      className={clsx(
                        "p-3 flex flex-col items-center text-center transition-all duration-200 rounded-lg",
                        isSelected ? "ring-2 ring-gold/60 shadow-lg shadow-gold/25" : "",
                        isSlotAvailable && !isSelected ? "hover:bg-gold/10 hover:border-gold/50" : "",
                        !isSlotAvailable ? "opacity-40 cursor-not-allowed" : "",
                      )}
                    >
                      <div className="text-sm font-bold mb-1">{slotName}</div>
                      <div className="text-xs text-gold/70">{isSlotAvailable ? `Slot ${slot + 1}` : "N/A"}</div>
                    </Button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Direction Selection (for attack armies) */}
          {armyType && (
            <div className="flex-1 flex flex-col justify-center mb-4">
              <h6 className="text-center mb-3 text-gold text-base font-bold">SPAWN DIRECTION</h6>
              {isLoadingDirections ? (
                <div className="flex justify-center py-6">
                  <LoadingAnimation />
                </div>
              ) : freeDirections.length > 0 ? (
                <div className="grid grid-cols-3 gap-3 sm:gap-4 lg:gap-5 mx-auto w-full max-w-[280px]">
                  <DirectionButton
                    direction={Direction.SOUTH_WEST}
                    label="↖"
                    availableDirections={freeDirections}
                    selectedDirection={selectedDirection}
                    onClick={setSelectedDirection}
                  />
                  <div />
                  <DirectionButton
                    direction={Direction.SOUTH_EAST}
                    label="↗"
                    availableDirections={freeDirections}
                    selectedDirection={selectedDirection}
                    onClick={setSelectedDirection}
                  />
                  <DirectionButton
                    direction={Direction.WEST}
                    label="←"
                    availableDirections={freeDirections}
                    selectedDirection={selectedDirection}
                    onClick={setSelectedDirection}
                  />
                  <div className="flex items-center justify-center text-4xl sm:text-5xl lg:text-6xl drop-shadow-lg">
                    🏰
                  </div>
                  <DirectionButton
                    direction={Direction.EAST}
                    label="→"
                    availableDirections={freeDirections}
                    selectedDirection={selectedDirection}
                    onClick={setSelectedDirection}
                  />
                  <DirectionButton
                    direction={Direction.NORTH_WEST}
                    label="↙"
                    availableDirections={freeDirections}
                    selectedDirection={selectedDirection}
                    onClick={setSelectedDirection}
                  />
                  <div />
                  <DirectionButton
                    direction={Direction.NORTH_EAST}
                    label="↘"
                    availableDirections={freeDirections}
                    selectedDirection={selectedDirection}
                    onClick={setSelectedDirection}
                  />
                </div>
              ) : (
                <div className="text-center p-3 bg-red/10 border border-red/30 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-red mx-auto mb-1" />
                  <p className="text-red text-sm">No adjacent tiles available</p>
                </div>
              )}
            </div>
          )}

          {/* Action Button */}
          <div className="mt-auto">
            <Button
              variant="gold"
              onClick={handleCreate}
              disabled={
                troopCount <= 0 || troopCount > maxAffordable || isLoading || (armyType && selectedDirection === null)
              }
              isLoading={isLoading}
              className="w-full py-4 text-base font-bold shadow-lg hover:shadow-xl transition-all duration-200"
            >
              {armyType
                ? "CREATE ATTACK ARMY"
                : `ADD DEFENSE - ${DEFENSE_NAMES[guardSlot as keyof typeof DEFENSE_NAMES]?.toUpperCase()}`}
            </Button>
          </div>
        </div>
      </div>
    </ModalContainer>
  );
};
