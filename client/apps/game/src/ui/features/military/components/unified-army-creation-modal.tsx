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
      variant={isSelected ? "gold" : isAvailable ? "default" : "outline"}
      size="md"
      onClick={() => isAvailable && onClick(direction)}
      disabled={!isAvailable}
      className={`aspect-square text-sm ${isAvailable ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}
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
  const [selectedDirection, setSelectedDirection] = useState<Direction | null>(direction || null);
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
    if (freeDirections.length > 0 && selectedDirection === null) {
      setSelectedDirection(freeDirections[0]);
    }
  }, [freeDirections, selectedDirection]);

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
      <div className="p-6 w-full max-h-[70vh] overflow-y-auto">
        {/* Header already handled by OSWindow title */}

        {/* Army Type Toggle */}
        <div className="mb-6">
          <h6 className="text-center mb-3 text-gold">ARMY TYPE</h6>
          <div className="flex justify-center gap-2">
            <Button
              variant={armyType ? "gold" : "outline"}
              onClick={() => setArmyType(true)}
              className="flex-1 max-w-xs"
            >
              Attack Army
            </Button>
            <Button
              variant={!armyType ? "gold" : "outline"}
              onClick={() => setArmyType(false)}
              className="flex-1 max-w-xs"
            >
              Defense Army
            </Button>
          </div>
        </div>

        {/* Defense Slot Selection */}
        {!armyType && (
          <div className="mb-6">
            <h6 className="text-center mb-3 text-gold">DEFENSE SLOT</h6>
            <div className="grid grid-cols-2 gap-3">
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
                    className={clsx(
                      "p-3 flex flex-col items-center text-center transition-all",
                      isSelected
                        ? "ring-2 ring-gold"
                        : isSlotAvailable
                          ? "opacity-80 hover:opacity-100"
                          : "opacity-40 cursor-not-allowed bg-gray/20 text-gray-400 border-gray-400/30",
                    )}
                  >
                    <div className={`font-semibold text-sm ${!isSlotAvailable ? "text-gray-400" : ""}`}>{slotName}</div>
                    <div className={`text-xs ${!isSlotAvailable ? "text-gray-400/60" : "text-gold/60"}`}>
                      {isSlotAvailable ? `Slot ${slot + 1}` : "Unavailable"}
                    </div>
                  </Button>
                );
              })}
            </div>
          </div>
        )}

        {/* Troop Selection */}
        <div className="space-y-4">
          {/* Combined Troop Selection Grid */}
          <div>
            <h6 className="text-center mb-2 text-gold text-sm font-bold">SELECT TROOP</h6>
            <div className="grid grid-cols-3 gap-2">
              {[TroopType.Crossbowman, TroopType.Knight, TroopType.Paladin].map((type) => (
                <div key={type} className="space-y-1.5">
                  {[TroopTier.T1, TroopTier.T2, TroopTier.T3].map((tier) => {
                    const balance = getBalance(
                      structureId,
                      getTroopResourceId(type, tier),
                      currentDefaultTick,
                      components,
                    ).balance;

                    console.log({ balance });
                    const isSelected = selectedTroopCombo.type === type && selectedTroopCombo.tier === tier;
                    const troopResourceForCard = resources.find((r) => r.id === getTroopResourceId(type, tier));
                    const available = Number(divideByPrecision(balance) || 0);

                    return (
                      <div
                        key={`${type}-${tier}`}
                        className={clsx(
                          "p-2 flex flex-col cursor-pointer transition-all duration-200 rounded border relative",
                          isSelected
                            ? "border-gold bg-gold/10 ring-1 ring-gold/50"
                            : available > 0
                              ? "border-brown/40 bg-brown/10 hover:border-gold/60 hover:bg-gold/5"
                              : "border-gray/30 bg-gray/5 opacity-40 cursor-not-allowed",
                        )}
                        onClick={() => available > 0 && setSelectedTroopCombo({ type, tier })}
                      >
                        {/* Tier Badge - Smaller */}
                        <div className="absolute -top-1 -right-1">
                          <div
                            className={clsx(
                              "w-5 h-5 rounded-full flex items-center justify-center text-xxs font-bold border shadow-sm",
                              available > 0 ? getTierStyle(`T${tier}`) : "bg-gray/50 text-gray-400 border-gray-400",
                            )}
                          >
                            {tier}
                          </div>
                        </div>

                        {/* Troop Name - Compact */}
                        <div className="text-center mb-1">
                          <div
                            className={clsx(
                              "font-semibold text-xxs leading-tight",
                              isSelected ? "text-gold" : available > 0 ? "text-gold/90" : "text-gray-400",
                            )}
                          >
                            {type}
                          </div>
                        </div>

                        {/* Resource Icon - Smaller */}
                        <div className="flex items-center justify-center p-1 bg-dark-brown/30 rounded mb-1">
                          <ResourceIcon resource={troopResourceForCard?.trait || ""} size="sm" withTooltip={false} />
                        </div>

                        {/* Available Count - Compact */}
                        <div
                          className={clsx(
                            "text-center text-xxs font-medium",
                            isSelected ? "text-gold" : available > 0 ? "text-gold/70" : "text-gray-400",
                          )}
                        >
                          {available > 0 ? available.toLocaleString() : "0"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Troop Count */}
          <div>
            <h6 className="text-center mb-2 text-gold">TROOP COUNT</h6>

            <div className="flex justify-center gap-2 mb-2">
              <Button
                variant="outline"
                size="xs"
                onClick={() => setTroopCount(Math.min(troopCount + 500, maxAffordable))}
                disabled={troopCount >= maxAffordable}
              >
                +500
              </Button>
              <Button
                variant="outline"
                size="xs"
                onClick={() => setTroopCount(maxAffordable)}
                disabled={troopCount >= maxAffordable}
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
              className="border border-gold/30 text-center"
            />

            <div className="text-xs text-gold/60 text-center mt-1">Max available: {maxAffordable.toLocaleString()}</div>
          </div>

          {/* Direction Selection (for explorers only) */}
          {armyType && (
            <div>
              <h6 className="text-center mb-2 text-gold">SPAWN DIRECTION</h6>
              {isLoadingDirections ? (
                <LoadingAnimation />
              ) : freeDirections.length > 0 ? (
                <div className="grid grid-cols-3 gap-2 mx-auto my-4 max-w-xs">
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
                  <div className="flex items-center justify-center text-4xl">🏰</div>
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
                <div className="text-center p-4 bg-red/10 border border-red/30 rounded">
                  <AlertTriangle className="w-6 h-6 text-red mx-auto mb-2" />
                  <p className="text-red text-sm">No adjacent tiles available for army deployment</p>
                </div>
              )}
            </div>
          )}

          {/* Resource Validation */}
          {troopCount > maxAffordable && (
            <div className="p-3 bg-red/10 border border-red/30 rounded">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-red" />
                <span className="text-red font-medium">Insufficient Resources</span>
              </div>
              <p className="text-xs text-red/80">
                Need {troopCount.toLocaleString()}, have {maxAffordable.toLocaleString()}
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-6">
          <Button
            variant="gold"
            onClick={handleCreate}
            disabled={
              troopCount <= 0 || troopCount > maxAffordable || isLoading || (armyType && selectedDirection === null)
            }
            isLoading={isLoading}
            className="flex-1"
          >
            {armyType
              ? "Create Attack Army"
              : `Add Defense - ${DEFENSE_NAMES[guardSlot as keyof typeof DEFENSE_NAMES]}`}
          </Button>
        </div>
      </div>
    </ModalContainer>
  );
};
