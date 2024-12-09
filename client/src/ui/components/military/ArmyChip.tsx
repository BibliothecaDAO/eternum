import { ReactComponent as Inventory } from "@/assets/icons/common/bagpack.svg";
import { ReactComponent as Plus } from "@/assets/icons/common/plus-sign.svg";
import { ReactComponent as Swap } from "@/assets/icons/common/swap.svg";
import { ReactComponent as Compass } from "@/assets/icons/Compass.svg";
import { BattleManager } from "@/dojo/modelManager/BattleManager";
import { useDojo } from "@/hooks/context/DojoContext";
import { ArmyInfo, getArmiesByPosition } from "@/hooks/helpers/useArmies";
import { armyHasTroops } from "@/hooks/helpers/useQuests";
import useUIStore from "@/hooks/store/useUIStore";
import { Position as PositionInterface } from "@/types/Position";
import { ArmyCapacity } from "@/ui/elements/ArmyCapacity";
import Button from "@/ui/elements/Button";
import { StaminaResource } from "@/ui/elements/StaminaResource";
import { Position } from "@bibliothecadao/eternum";
import { LucideArrowRight } from "lucide-react";
import React, { Dispatch, SetStateAction, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { InventoryResources } from "../resources/InventoryResources";
import { Exchange } from "../structures/worldmap/StructureCard";
import { ArmyManagementCard, ViewOnMapIcon } from "./ArmyManagementCard";
import { TroopDisplay } from "./TroopChip";

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
        const { x, y } = new PositionInterface(position).getNormalized();
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

  const nextBlockTimestamp = useUIStore((state) => state.nextBlockTimestamp);

  const [editMode, setEditMode] = useState(false);

  const battleManager = useMemo(() => new BattleManager(army.battle_id, dojo), [army.battle_id]);

  const isHome = army.isHome;

  const updatedArmy = useMemo(() => {
    const updatedBattle = battleManager.getUpdatedBattle(nextBlockTimestamp!);
    const updatedArmy = battleManager.getUpdatedArmy(army, updatedBattle);
    return updatedArmy;
  }, [nextBlockTimestamp, army]);

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
          <ArmyManagementCard army={updatedArmy!} owner_entity={updatedArmy!.entityOwner.entity_owner_id} />
        </>
      ) : showTroopSwap ? (
        <ArmyMergeTroopsPanel giverArmy={updatedArmy!} setShowMergeTroopsPopup={setShowTroopSwap} />
      ) : (
        <>
          <div className="flex w-full h-full justify-between">
            <div className="flex w-full justify-between py-2">
              <div className="flex flex-col w-[45%]">
                <div className="h4 items-center justify-between text-xl mb-2 flex flex-row">
                  <div className="mr-2 text-base">{updatedArmy!.name}</div>
                  {showButtons !== undefined && showButtons === true && (
                    <div className="flex flex-row mt-1 h-6 gap-1 mr-2">
                      {updatedArmy?.isMine && (
                        <React.Fragment>
                          <Plus
                            className={`w-5 h-5 fill-gold hover:fill-gold/50 hover:scale-110 transition-all duration-300 ${
                              updatedArmy.quantity.value === 0n ? "animate-pulse" : ""
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
                          {updatedArmy.quantity.value > 0 && (
                            <>
                              <ViewOnMapIcon
                                className="w-5 h-5 hover:scale-110 transition-all duration-300"
                                position={{ x: Number(updatedArmy!.position.x), y: Number(updatedArmy!.position.y) }}
                              />
                              {isOnMap && <NavigateToPositionIcon position={updatedArmy!.position} />}
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
                      {updatedArmy && updatedArmy.quantity.value > 0 && (
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
                {!army.protectee && armyHasTroops([updatedArmy]) && (
                  <div className="flex flex-row justify-between font-bold text-xs mr-2">
                    <div className="h-full flex items-end">
                      {isHome && <div className="text-xs px-2 text-green">At Base</div>}
                    </div>
                    <div className="flex flex-col items-end">
                      <StaminaResource entityId={updatedArmy!.entity_id} />
                      <ArmyCapacity army={updatedArmy} />
                    </div>
                  </div>
                )}
              </div>
              <div className="flex flex-col content-center w-[55%]">
                <TroopDisplay troops={updatedArmy!.troops} />
                {showInventory && (
                  <InventoryResources
                    entityId={updatedArmy!.entity_id}
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

  const getArmies = getArmiesByPosition();

  const armies = useMemo(() => {
    return getArmies({ x: giverArmy.position.x, y: giverArmy.position.y }).filter(
      (army) => army.entity_id !== giverArmy.entity_id,
    );
  }, [giverArmy]);

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
          giverArmyEntityId={giverArmy.entity_id}
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
    if (selectedArmy?.entity_id === army.entity_id) {
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
          key={army.entity_id}
          className={`rounded cursor-pointer transition-all duration-300 ${
            selectedArmy?.entity_id === army.entity_id ? "bg-gray-300" : "bg-brown"
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
