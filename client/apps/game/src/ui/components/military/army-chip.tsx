import { useUIStore } from "@/hooks/store/use-ui-store";
import { Position } from "@/types/position";
import { ArmyManagementCard } from "@/ui/components/military/army-management-card";
import { TroopChip } from "@/ui/components/military/troop-chip";
import { InventoryResources } from "@/ui/components/resources/inventory-resources";
import { ArmyCapacity } from "@/ui/elements/army-capacity";
import Button from "@/ui/elements/button";
import { StaminaResource } from "@/ui/elements/stamina-resource";
import { ViewOnMapIcon } from "@/ui/elements/view-on-map-icon";
import { HelpModal } from "@/ui/modules/military/help-modal";
import { getBlockTimestamp } from "@/utils/timestamp";
import { armyHasTroops, getEntityIdFromKeys, StaminaManager } from "@bibliothecadao/eternum";
import { useDojo, useQuery } from "@bibliothecadao/react";
import { ArmyInfo, TroopTier, TroopType } from "@bibliothecadao/types";
import { useComponentValue } from "@dojoengine/react";
import { ArrowLeftRight, CirclePlus, LucideArrowRight } from "lucide-react";
import React, { useCallback, useMemo, useState } from "react";
import { useLocation } from "wouter";

export const NavigateToPositionIcon = ({
  position,
  hideTooltip = false,
  className = "",
  tooltipContent = "Navigate to Position",
}: {
  position: Position;
  hideTooltip?: boolean;
  className?: string;
  tooltipContent?: string;
}) => {
  const setTooltip = useUIStore((state) => state.setTooltip);
  const setNavigationTarget = useUIStore((state) => state.setNavigationTarget);

  return (
    <img
      src="/image-icons/compass.png"
      className={`w-5 h-5 fill-gold hover:fill-gold/50 transition-all duration-300 ${className}`}
      onClick={() => {
        const { x, y } = position.getNormalized();
        setNavigationTarget({
          col: x,
          row: y,
        });
      }}
      onMouseEnter={() => {
        if (hideTooltip) return;
        setTooltip({
          content: tooltipContent,
          position: "bottom",
        });
      }}
      onMouseLeave={() => {
        setTooltip(null);
      }}
    />
  );
};

export const ArmyChip = ({
  army,
  className,
  showButtons,
}: {
  army: ArmyInfo;
  className?: string;
  showButtons?: boolean;
}) => {
  const {
    setup: { components },
  } = useDojo();
  const setTooltip = useUIStore((state) => state.setTooltip);
  const toggleModal = useUIStore((state) => state.toggleModal);

  const [editMode, setEditMode] = useState(false);

  const isHome = army.isHome;

  const [location] = useLocation();
  const { hexPosition } = useQuery();

  const isOnMap = useMemo(() => location.includes("map"), [location]);

  const resources = useComponentValue(components.Resource, getEntityIdFromKeys([BigInt(army.entityId)]));

  const stamina = useMemo(() => {
    if (!army.troops) return { amount: 0n, updated_tick: 0n };
    const { currentArmiesTick } = getBlockTimestamp();
    return StaminaManager.getStamina(army.troops, currentArmiesTick);
  }, [army.troops]);

  const maxStamina = useMemo(() => {
    if (!army.troops) return 0;
    return StaminaManager.getMaxStamina(army.troops.category as TroopType, army.troops.tier as TroopTier);
  }, [army.troops]);

  const onTroopSwap = useCallback(() => {
    toggleModal(
      <HelpModal
        selected={{
          type: "explorer",
          id: army.entityId,
          hex: new Position({ x: Number(army.position.x), y: Number(army.position.y) }).getContract(),
        }}
        target={{
          type: "structure",
          id: army.entity_owner_id,
          hex: new Position({ x: Number(hexPosition?.col), y: Number(hexPosition?.row) }).getContract(),
        }}
        allowBothDirections={true}
      />,
    );
  }, [army, hexPosition, toggleModal]);

  return (
    <div
      className={`items-center text-xs p-2 hover:bg-gold/20 ${army.isMine ? "bg-blueish/5" : "bg-red/5"} ${
        army ? "defensive-army-selector" : "attacking-army-selector"
      } rounded-md border-gold/20 ${className}`}
    >
      {editMode ? (
        <>
          <Button className="my-2" size="xs" variant="red" onClick={() => setEditMode(!editMode)}>
            <div className="flex flex-row">
              <LucideArrowRight className="w-4 h-4 rotate-180 mr-1" />
              <span> Add Troops</span>
            </div>
          </Button>
          <ArmyManagementCard army={army} owner_entity={army.entity_owner_id} />
        </>
      ) : (
        <>
          <div className="flex w-full h-full justify-between p-2 gap-4">
            <div className="flex flex-col justify-between w-[45%]">
              <div className="flex items-center justify-between mb-2">
                <div className="text-base mr-2 truncate">{army.name}</div>
                {showButtons && army.isMine && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isHome && (
                      <CirclePlus
                        className={`w-5 h-5 hover:fill-gold/50 hover:scale-110 transition-all duration-300 cursor-pointer ${
                          army.troops.count === 0n ? "animate-pulse" : ""
                        } ${army ? "defensive-army-edit-selector" : "attacking-army-edit-selector"}`}
                        onClick={() => {
                          setTooltip(null);
                          setEditMode(!editMode);
                        }}
                        onMouseEnter={() => setTooltip({ content: "Edit", position: "top" })}
                        onMouseLeave={() => setTooltip(null)}
                      />
                    )}
                    {army.troops.count > 0n && (
                      <React.Fragment>
                        {!isHome && (
                          <ViewOnMapIcon
                            className="w-5 h-5 hover:scale-110 transition-all duration-300 cursor-pointer"
                            position={new Position({ x: Number(army.position.x), y: Number(army.position.y) })}
                          />
                        )}
                        {isOnMap && <NavigateToPositionIcon position={new Position(army.position)} />}
                        {isHome && (
                          <ArrowLeftRight
                            className={`w-5 h-5 fill-gold hover:fill-gold/50 hover:scale-110 transition-all duration-300 cursor-pointer ${
                              army ? "defensive-army-swap-selector" : "attacking-army-swap-selector"
                            }`}
                            onClick={() => {
                              setTooltip(null);
                              onTroopSwap();
                            }}
                            onMouseEnter={() =>
                              setTooltip({
                                content: "Swap troops or resources if at base",
                                position: "top",
                              })
                            }
                            onMouseLeave={() => setTooltip(null)}
                          />
                        )}
                      </React.Fragment>
                    )}
                  </div>
                )}
              </div>
              {armyHasTroops([army]) && (
                <div className="flex justify-between items-end mt-auto">
                  <div className="flex items-center">{isHome && <div className="text-green text-xs">At Base</div>}</div>
                  <div className="flex flex-col items-end gap-1">
                    <StaminaResource entityId={army.entityId} stamina={stamina} maxStamina={maxStamina} />
                    <ArmyCapacity resource={resources} />
                  </div>
                </div>
              )}
            </div>
            <div className="flex flex-col w-[55%] gap-2">
              <TroopChip troops={army.troops} className="h-auto" iconSize="lg" />
              {army.troops.count > 0n && resources && (
                <InventoryResources
                  resources={resources}
                  className="flex gap-1 h-14 overflow-x-auto no-scrollbar"
                  resourcesIconSize="xs"
                  textSize="xxs"
                />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
