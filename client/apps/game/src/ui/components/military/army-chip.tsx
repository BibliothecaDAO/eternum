import { ReactComponent as Inventory } from "@/assets/icons/common/bagpack.svg";
import { ReactComponent as Plus } from "@/assets/icons/common/plus-sign.svg";
import { ReactComponent as Swap } from "@/assets/icons/common/swap.svg";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { Position } from "@/types/position";
import { ArmyManagementCard } from "@/ui/components/military/army-management-card";
import { TroopChip } from "@/ui/components/military/troop-chip";
import { InventoryResources } from "@/ui/components/resources/inventory-resources";
import { ArmyCapacity } from "@/ui/elements/army-capacity";
import Button from "@/ui/elements/button";
import { StaminaResource } from "@/ui/elements/stamina-resource";
import { ViewOnMapIcon } from "@/ui/elements/view-on-map-icon";
import { armyHasTroops } from "@bibliothecadao/eternum";
import { ArmyInfo } from "@bibliothecadao/types"
import { LucideArrowRight } from "lucide-react";
import React, { Dispatch, SetStateAction, useMemo, useState } from "react";
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
  const setTooltip = useUIStore((state) => state.setTooltip);

  const [showInventory, setShowInventory] = useState(false);
  const [showTroopSwap, setShowTroopSwap] = useState(false);

  const [editMode, setEditMode] = useState(false);

  const isHome = army.isHome;

  const [location] = useLocation();
  const isOnMap = useMemo(() => location.includes("map"), [location]);

  return (
    <div
      className={`items-center text-xs p-2 hover:bg-gold/20 ${army.isMine ? "bg-blueish/5" : "bg-red/5"} ${army ? "defensive-army-selector" : "attacking-army-selector"
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
          <ArmyManagementCard army={army} owner_entity={army.entity_owner_id} />
        </>
      ) : showTroopSwap ? (
        <ArmyMergeTroopsPanel giverArmy={army} setShowMergeTroopsPopup={setShowTroopSwap} />
      ) : (
        <>
          <div className="flex w-full h-full justify-between p-2 gap-4">
            <div className="flex flex-col justify-between w-[45%]">
              <div className="flex items-center justify-between mb-2">
                <div className="text-base mr-2 truncate">{army.name}</div>
                {showButtons && army.isMine && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Plus
                      className={`w-5 h-5 fill-gold hover:fill-gold/50 hover:scale-110 transition-all duration-300 cursor-pointer ${army.troops.count === 0n ? "animate-pulse" : ""
                        } ${army ? "defensive-army-edit-selector" : "attacking-army-edit-selector"}`}
                      onClick={() => {
                        setTooltip(null);
                        setEditMode(!editMode);
                      }}
                      onMouseEnter={() => setTooltip({ content: "Edit", position: "top" })}
                      onMouseLeave={() => setTooltip(null)}
                    />
                    {army.troops.count > 0n && (
                      <React.Fragment>
                        <ViewOnMapIcon
                          className="w-5 h-5 hover:scale-110 transition-all duration-300 cursor-pointer"
                          position={new Position({ x: Number(army.position.x), y: Number(army.position.y) })}
                        />
                        {isOnMap && <NavigateToPositionIcon position={new Position(army.position)} />}
                        <Swap
                          className={`w-5 h-5 fill-gold hover:fill-gold/50 hover:scale-110 transition-all duration-300 cursor-pointer ${army ? "defensive-army-swap-selector" : "attacking-army-swap-selector"
                            }`}
                          onClick={() => {
                            setTooltip(null);
                            setShowTroopSwap(!showTroopSwap);
                          }}
                          onMouseEnter={() =>
                            setTooltip({
                              content: "Swap troops or resources (only possible on same hex)",
                              position: "top",
                            })
                          }
                          onMouseLeave={() => setTooltip(null)}
                        />
                      </React.Fragment>
                    )}
                    {army.troops.count > 0n && (
                      <Inventory
                        className="w-5 h-5 fill-gold hover:fill-gold/50 hover:scale-110 transition-all duration-300 cursor-pointer"
                        onClick={() => {
                          setTooltip(null);
                          setShowInventory(!showInventory);
                        }}
                        onMouseEnter={() => setTooltip({ content: "Inventory", position: "top" })}
                        onMouseLeave={() => setTooltip(null)}
                      />
                    )}
                  </div>
                )}
              </div>
              {armyHasTroops([army]) && (
                <div className="flex justify-between items-end mt-auto">
                  <div className="flex items-center">{isHome && <div className="text-green text-xs">At Base</div>}</div>
                  <div className="flex flex-col items-end gap-1">
                    <StaminaResource entityId={army.entityId} />
                    <ArmyCapacity army={army} />
                  </div>
                </div>
              )}
            </div>
            <div className="flex flex-col w-[55%] gap-2">
              <TroopChip troops={army.troops} className="h-auto" iconSize="lg" />
              {showInventory && (
                <InventoryResources
                  entityId={army.entityId}
                  className="flex gap-1 h-14 overflow-x-auto no-scrollbar"
                  resourcesIconSize="xs"
                />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// todo: fix this to merge with adjacent hex armies
const ArmyMergeTroopsPanel = ({
  giverArmy,
  setShowMergeTroopsPopup,
}: {
  giverArmy: ArmyInfo;
  setShowMergeTroopsPopup: Dispatch<SetStateAction<boolean>>;
}) => {
  return <div>work in progress</div>;

  // const [selectedReceiverArmy, setSelectedReceiverArmy] = useState<ArmyInfo | null>(null);

  // const armyAtPosition = usePlayerArmyAtPosition({ position: giverArmy.position });

  // return (
  //   <div className="py-2">
  //     <div className="flex flex-row justify-between">
  //       <Button className="mb-3 w-[30%]" variant="default" size="xs" onClick={() => setShowMergeTroopsPopup(false)}>
  //         &lt; Back
  //       </Button>
  //     </div>
  //     {selectedReceiverArmy ? (
  //       <Exchange
  //         giverArmyName={giverArmy.name}
  //         giverArmyEntityId={giverArmy.entityId}
  //         takerArmy={selectedReceiverArmy}
  //         allowReverse={selectedReceiverArmy.isMine}
  //       />
  //     ) : (
  //       armyAtPosition && <ArmySelector armies={[armyAtPosition]} onSelect={setSelectedReceiverArmy} />
  //     )}
  //     <div className="text-xxs">swapping only possible on same position</div>
  //   </div>
  // );
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
          className={`rounded cursor-pointer transition-all duration-300 ${selectedArmy?.entityId === army.entityId ? "bg-gray-300" : "bg-brown"
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
