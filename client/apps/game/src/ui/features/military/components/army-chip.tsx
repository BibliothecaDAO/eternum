import { useBlockTimestamp } from "@/hooks/helpers/use-block-timestamp";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { Position } from "@/types/position";
import Button from "@/ui/design-system/atoms/button";
import { ArmyCapacity } from "@/ui/design-system/molecules/army-capacity";
import CircleButton from "@/ui/design-system/molecules/circle-button";
import { StaminaResource } from "@/ui/design-system/molecules/stamina-resource";
import { ViewOnMapIcon } from "@/ui/design-system/molecules/view-on-map-icon";
import { InventoryResources } from "@/ui/features/economy/resources";
import { armyHasTroops, getArmyRelicEffects, getEntityIdFromKeys, StaminaManager } from "@bibliothecadao/eternum";
import { useDojo, useQuery } from "@bibliothecadao/react";
import { ActorType, ArmyInfo, RelicRecipientType, TroopTier, TroopType } from "@bibliothecadao/types";
import { useComponentValue } from "@dojoengine/react";
import { ArrowLeftRight, CirclePlus, LucideArrowRight } from "lucide-react";
import React, { useCallback, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ArmyManagementCard } from "./army-management-card";
import { HelpModal } from "./help-modal";
import { TroopChip } from "./troop-chip";

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
    <CircleButton
      image="/image-icons/compass.png"
      size="md"
      className={` fill-gold hover:fill-gold/50 transition-all duration-300 ${className}`}
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
  const hasAdjacentOwnedStructure = army.hasAdjacentStructure;

  const [location] = useLocation();
  const { hexPosition } = useQuery();

  const isOnMap = useMemo(() => location.includes("map"), [location]);

  const resources = useComponentValue(components.Resource, getEntityIdFromKeys([BigInt(army.entityId)]));

  const { currentArmiesTick } = useBlockTimestamp();

  const relicEffects = useMemo(() => {
    return getArmyRelicEffects(army.troops, currentArmiesTick).map((relic) => relic.id);
  }, [army.troops, currentArmiesTick]);

  const stamina = useMemo(() => {
    if (!army.troops) return { amount: 0n, updated_tick: 0n };

    // Convert relic effects to resource IDs for StaminaManager
    // todo: check relic effect active
    return StaminaManager.getStamina(army.troops, currentArmiesTick);
  }, [army.troops, currentArmiesTick]);

  const maxStamina = useMemo(() => {
    if (!army.troops) return 0;
    return StaminaManager.getMaxStamina(army.troops.category as TroopType, army.troops.tier as TroopTier);
  }, [army.troops]);

  const onTroopSwap = useCallback(() => {
    toggleModal(
      <HelpModal
        selected={{
          type: ActorType.Explorer,
          id: army.entityId,
          hex: new Position({ x: Number(army.position.x), y: Number(army.position.y) }).getContract(),
        }}
        target={{
          type: ActorType.Structure,
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
            <div className="flex flex-col justify-between w-[55%]">
              <div className="flex items-center justify-between mb-2">
                <div
                  className="text-base mr-2 truncate cursor-default"
                  onMouseEnter={() =>
                    setTooltip({
                      content: `Army ID: ${army.entityId}`,
                      position: "bottom",
                    })
                  }
                  onMouseLeave={() => setTooltip(null)}
                >
                  {army.name}
                </div>
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
                        {(isHome || hasAdjacentOwnedStructure) && (
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

                        {
                          <ViewOnMapIcon
                            className="w-5 h-5 hover:scale-110 transition-all duration-300 cursor-pointer"
                            position={new Position({ x: Number(army.position.x), y: Number(army.position.y) })}
                          />
                        }
                        {isOnMap && <NavigateToPositionIcon position={new Position(army.position)} />}
                      </React.Fragment>
                    )}
                  </div>
                )}
              </div>
              {armyHasTroops([army]) && (
                <div className="flex justify-between items-end mt-auto">
                  <div className="flex items-center">
                    {isHome && (
                      <div
                        className="text-emerald-400 text-xs cursor-default"
                        onMouseEnter={() =>
                          setTooltip({
                            content: "Army is at home base - can add troops and swap resources",
                            position: "top",
                          })
                        }
                        onMouseLeave={() => setTooltip(null)}
                      >
                        At Home
                      </div>
                    )}
                    {!isHome && hasAdjacentOwnedStructure && (
                      <div
                        className="text-blue-400 text-xs cursor-default"
                        onMouseEnter={() =>
                          setTooltip({
                            content:
                              "Army is near an owned structure - can swap resources and add transfer troops from guards but not structure balance",
                            position: "top",
                          })
                        }
                        onMouseLeave={() => setTooltip(null)}
                      >
                        At Base
                      </div>
                    )}
                    {!isHome && !hasAdjacentOwnedStructure && (
                      <div
                        className="text-amber-400 text-xs cursor-default"
                        onMouseEnter={() =>
                          setTooltip({
                            content: "Army is away from base - limited actions available",
                            position: "top",
                          })
                        }
                        onMouseLeave={() => setTooltip(null)}
                      >
                        Away
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <StaminaResource entityId={army.entityId} stamina={stamina} maxStamina={maxStamina} />
                    <ArmyCapacity resource={resources} />
                  </div>
                </div>
              )}
            </div>
            <div className="flex flex-col w-[45%] gap-2">
              <TroopChip troops={army.troops} className="h-auto" iconSize="lg" />
              {army.troops.count > 0n && resources && (
                <InventoryResources
                  resources={resources}
                  relicEffects={relicEffects}
                  className="flex gap-1 h-14 overflow-x-auto no-scrollbar"
                  resourcesIconSize="xs"
                  entityId={army.entityId}
                  recipientType={RelicRecipientType.Explorer}
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
