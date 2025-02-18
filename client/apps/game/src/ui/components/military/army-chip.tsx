import { ReactComponent as Inventory } from "@/assets/icons/common/bagpack.svg";
import { ReactComponent as Plus } from "@/assets/icons/common/plus-sign.svg";
import { ReactComponent as Swap } from "@/assets/icons/common/swap.svg";
import { ReactComponent as Compass } from "@/assets/icons/compass.svg";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { Position } from "@/types/position";
import { ArmyManagementCard, ViewOnMapIcon } from "@/ui/components/military/army-management-card";
import { TroopChip } from "@/ui/components/military/troop-chip";
import { InventoryResources } from "@/ui/components/resources/inventory-resources";
import { Exchange } from "@/ui/components/structures/worldmap/structure-card";
import { ArmyCapacity } from "@/ui/elements/army-capacity";
import Button from "@/ui/elements/button";
import { StaminaResource } from "@/ui/elements/stamina-resource";
import { armyHasTroops, ArmyInfo } from "@bibliothecadao/eternum";
import { useArmiesAtPosition, useDojo } from "@bibliothecadao/react";
import { LucideArrowRight } from "lucide-react";
import React, { Dispatch, SetStateAction, useMemo, useState } from "react";
import { useLocation } from "wouter";
export const NavigateToPositionIcon = ({
  position,
  hideTooltip = false,
  className = "",
}: {
  position: Position;
  hideTooltip?: boolean;
  className?: string;
}) => {
  const setTooltip = useUIStore((state) => state.setTooltip);
  const setNavigationTarget = useUIStore((state) => state.setNavigationTarget);

  return (
    <Compass
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
          content: "Navigate to Army",
          position: "top",
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
  const dojo = useDojo();
  const setTooltip = useUIStore((state) => state.setTooltip);

  const [showInventory, setShowInventory] = useState(false);
  const [showTroopSwap, setShowTroopSwap] = useState(false);

  const [editMode, setEditMode] = useState(false);

  const isHome = army.isHome;

  const [location] = useLocation();
  const isOnMap = useMemo(() => location.includes("map"), [location]);

  return (
    <div
      className={`items-center text-xs px-2 hover:bg-gold/20 ${army.isMine ? "bg-blueish/20" : "bg-red/20"} ${
        army.protectee ? "defensive-army-selector" : "attacking-army-selector"
      } rounded-md border-gold/20 ${className}`}
    >
      {editMode ? (
        <>
          <Button className="my-2" size="xs" variant="red" onClick={() => setEditMode(!editMode)}>
            <div className="flex flex-row">
              <LucideArrowRight className="w-4 h-4 rotate-180 mr-1" />
              <span> Exit</span>
            </div>
          </Button>
          <ArmyManagementCard army={army} owner_entity={army.entityOwner.entity_owner_id} />
        </>
      ) : showTroopSwap ? (
        <ArmyMergeTroopsPanel giverArmy={army} setShowMergeTroopsPopup={setShowTroopSwap} />
      ) : (
        <>
          <div className="flex w-full h-full justify-between">
            <div className="flex w-full justify-between py-2">
              <div className="flex flex-col w-[45%]">
                <div className="h4 items-center justify-between text-xl mb-2 flex flex-row">
                  <div className="mr-2 text-base">{army.name}</div>
                  {showButtons !== undefined && showButtons === true && (
                    <div className="flex flex-row mt-1 h-6 gap-1 mr-2">
                      {army.isMine && (
                        <React.Fragment>
                          <Plus
                            className={`w-5 h-5 fill-gold hover:fill-gold/50 hover:scale-110 transition-all duration-300 ${
                              army.quantity.value === 0n ? "animate-pulse" : ""
                            } ${army.protectee ? "defensive-army-edit-selector" : "attacking-army-edit-selector"}`}
                            onClick={() => {
                              setTooltip(null);
                              setEditMode(!editMode);
                            }}
                            onMouseEnter={() => {
                              setTooltip({
                                content: "Edit",
                                position: "top",
                              });
                            }}
                            onMouseLeave={() => {
                              setTooltip(null);
                            }}
                          />
                          {army.quantity.value > 0 && (
                            <>
                              <ViewOnMapIcon
                                className="w-5 h-5 hover:scale-110 transition-all duration-300"
                                position={
                                  new Position({
                                    x: Number(army.position.x),
                                    y: Number(army.position.y),
                                  })
                                }
                              />
                              {isOnMap && <NavigateToPositionIcon position={new Position(army.position)} />}
                              <Swap
                                className={`w-5 h-5 fill-gold mt-0.5 hover:fill-gold/50 hover:scale-110 transition-all duration-300 ${
                                  army.protectee ? "defensive-army-swap-selector" : "attacking-army-swap-selector"
                                }`}
                                onClick={() => {
                                  setTooltip(null);
                                  setShowTroopSwap(!showTroopSwap);
                                }}
                                onMouseEnter={() => {
                                  setTooltip({
                                    content: "Swap troops or resources (only possible on same hex)",
                                    position: "top",
                                  });
                                }}
                                onMouseLeave={() => {
                                  setTooltip(null);
                                }}
                              />
                            </>
                          )}
                        </React.Fragment>
                      )}
                      {army.quantity.value > 0 && (
                        <Inventory
                          className="w-4 h-5 fill-gold hover:fill-gold/50 hover:scale-110 transition-all duration-300"
                          onClick={() => {
                            setTooltip(null);
                            setShowInventory(!showInventory);
                          }}
                          onMouseEnter={() => {
                            setTooltip({
                              content: "Inventory",
                              position: "top",
                            });
                          }}
                          onMouseLeave={() => {
                            setTooltip(null);
                          }}
                        />
                      )}
                    </div>
                  )}
                </div>
                {!army.protectee && armyHasTroops([army]) && (
                  <div className="flex flex-row justify-between font-bold text-xs mr-2">
                    <div className="h-full flex items-end">
                      {isHome && <div className="text-xs px-2 text-green">At Base</div>}
                    </div>
                    <div className="flex flex-col items-end">
                      <StaminaResource entityId={army.entityId} />
                      <ArmyCapacity army={army} />
                    </div>
                  </div>
                )}
              </div>
              <div className="flex flex-col content-center w-[55%]">
                <TroopChip troops={army.troops} className="h-full" iconSize="lg" />
                {showInventory && (
                  <InventoryResources
                    entityId={army.entityId}
                    className="flex gap-1 h-14 mt-2 overflow-x-auto no-scrollbar"
                    resourcesIconSize="xs"
                  />
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const ArmyMergeTroopsPanel = ({
  giverArmy,
  setShowMergeTroopsPopup,
}: {
  giverArmy: ArmyInfo;
  setShowMergeTroopsPopup: Dispatch<SetStateAction<boolean>>;
}) => {
  const [selectedReceiverArmy, setSelectedReceiverArmy] = useState<ArmyInfo | null>(null);

  const armiesAtPosition = useArmiesAtPosition({ position: giverArmy.position });

  const armies = useMemo(() => {
    return armiesAtPosition.filter((army) => army.entityId !== giverArmy.entityId);
  }, [giverArmy, armiesAtPosition]);

  return (
    <div className="py-2">
      <div className="flex flex-row justify-between">
        <Button className="mb-3 w-[30%]" variant="default" size="xs" onClick={() => setShowMergeTroopsPopup(false)}>
          &lt; Back
        </Button>
      </div>
      {selectedReceiverArmy ? (
        <Exchange
          giverArmyName={giverArmy.name}
          giverArmyEntityId={giverArmy.entityId}
          takerArmy={selectedReceiverArmy}
          allowReverse={selectedReceiverArmy.isMine}
        />
      ) : (
        <ArmySelector armies={armies} onSelect={setSelectedReceiverArmy} />
      )}
      <div className="text-xxs">swapping only possible on same position</div>
    </div>
  );
};

const ArmySelector = ({ armies, onSelect }: { armies: ArmyInfo[]; onSelect: (army: ArmyInfo) => void }) => {
  const [selectedArmy, setSelectedArmy] = useState<ArmyInfo | null>(null);

  const handleArmyClick = (army: ArmyInfo) => {
    if (selectedArmy?.entityId === army.entityId) {
      setSelectedArmy(null);
    } else {
      setSelectedArmy(army);
    }
  };

  return (
    <div className="flex flex-col space-y-2">
      <div className="text-sm self-center">Choose destination army</div>
      {armies.map((army) => (
        <div
          key={army.entityId}
          className={`rounded cursor-pointer transition-all duration-300 ${
            selectedArmy?.entityId === army.entityId ? "bg-gray-300" : "bg-brown"
          }`}
          onClick={() => handleArmyClick(army)}
        >
          <ArmyChip army={army} className="bg-green/20" />
        </div>
      ))}
      <Button disabled={!selectedArmy} onClick={() => onSelect(selectedArmy!)}>
        Continue
      </Button>
    </div>
  );
};
