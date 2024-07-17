import { BattleInfo, useBattlesByPosition } from "@/hooks/helpers/battles/useBattles";
import { ArmyInfo, usePositionArmies } from "@/hooks/helpers/useArmies";
import { Structure, useStructuresPosition } from "@/hooks/helpers/useStructures";
import useUIStore from "@/hooks/store/useUIStore";
import { ClickedHex } from "@/types";
import { ArmyChip } from "@/ui/components/military/ArmyChip";
import { EnemyArmies } from "@/ui/components/military/Battle";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/elements/Select";
import { Position } from "@bibliothecadao/eternum";
import { useEffect, useMemo, useState } from "react";

type ToShow = {
  showSelectableUnits: boolean;
  showEnnemies: boolean;
  showStructure: boolean;
};

export const EntityDetails = () => {
  const clickedHex = useUIStore((state) => state.clickedHex);
  const selectedEntity = useUIStore((state) => state.selectedEntity);

  const [ownArmySelected, setOwnArmySelected] = useState(selectedEntity);

  const hexPosition = useMemo(() => {
    if (selectedEntity) return { x: selectedEntity.position.x, y: selectedEntity.position.y };
    if (clickedHex) return { x: clickedHex.contractPos.col, y: clickedHex.contractPos.row };
  }, [clickedHex, selectedEntity]);

  const battle = useBattlesByPosition(hexPosition || { x: 0, y: 0 });

  const { useFormattedStructureAtPosition } = useStructuresPosition({ position: hexPosition || { x: 0, y: 0 } });
  const formattedStructureAtPosition = useFormattedStructureAtPosition();

  const { userAttackingArmies, enemyArmies } = usePositionArmies({
    position: { x: hexPosition?.x || 0, y: hexPosition?.y || 0 },
  });

  const panelSelectedEntity = useMemo(() => {
    if (ownArmySelected) return ownArmySelected;
    if (userAttackingArmies.length > 0 && clickedHex && enemyArmies.length > 0) {
      const entity = {
        id: BigInt(userAttackingArmies[0].entity_id),
        position: { x: clickedHex.contractPos.col, y: clickedHex.contractPos.row },
      };
      setOwnArmySelected(entity);
      return entity;
    }
  }, [clickedHex, ownArmySelected]);

  const ownArmy = useMemo(() => {
    if (!panelSelectedEntity) return;
    return userAttackingArmies.find((army) => army.entity_id === panelSelectedEntity.id);
  }, [userAttackingArmies, panelSelectedEntity]);

  const toShow = checkWhatToShow(
    battle,
    panelSelectedEntity,
    clickedHex,
    userAttackingArmies,
    enemyArmies,
    formattedStructureAtPosition,
  );

  return (
    hexPosition && (
      <div className="px-2 h-full">
        <Coordinates position={hexPosition} />
        {toShow.showSelectableUnits && (
          <SelectActiveArmy
            selectedEntity={panelSelectedEntity}
            setOwnArmySelected={setOwnArmySelected}
            userAttackingArmies={userAttackingArmies}
          />
        )}
        {/* {toShow.showStructure && <StructureCard position={hexPosition} ownArmySelected={ownArmy} />} */}
        {toShow.showEnnemies && <EnemyArmies armies={enemyArmies} ownArmySelected={ownArmy!} />}
        {!toShow.showEnnemies && !toShow.showStructure && "Nothing to show here"}
      </div>
    )
  );
};

const Coordinates = ({ position }: { position: Position }) => {
  return (
    <div className="p-2 flex justify-between">
      <h5>Coordinates</h5>
      <div className=" font-bold flex  space-x-2 justify-between self-center ">
        <div>{`x: ${position.x?.toLocaleString()}`}</div>
        <div>{`y: ${position.y?.toLocaleString()}`}</div>
      </div>
    </div>
  );
};

const SelectActiveArmy = ({
  selectedEntity,
  setOwnArmySelected,
  userAttackingArmies,
}: {
  selectedEntity:
    | {
        id: bigint;
        position: Position;
      }
    | undefined;
  setOwnArmySelected: (val: any) => void;
  userAttackingArmies: ArmyInfo[];
}) => {
  const [currentEntity, setCurrentEntity] = useState(selectedEntity);

  useEffect(() => {
    setOwnArmySelected(currentEntity);
  }, [currentEntity]);

  return (
    <div className="w-[31rem]">
      <Select
        value={currentEntity?.id.toString() || ""}
        onValueChange={(a: string) => {
          console.log(a);
          setCurrentEntity({ id: BigInt(a), position: selectedEntity?.position || { x: 0, y: 0 } });
        }}
      >
        <SelectTrigger className="w-[31rem] px-2">
          <SelectValue placeholder="Your armies">
            {currentEntity &&
              userAttackingArmies.find((army) => army.entity_id.toString() === currentEntity.id.toString()) && (
                <ArmyChip
                  key={currentEntity.id.toString()}
                  className={`w-[27rem] bg-green/10`}
                  army={userAttackingArmies.find((army) => army.entity_id.toString() === currentEntity.id.toString())!}
                />
              )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="text-gold w-[31rem]">
          {userAttackingArmies.map((army, index) => {
            army.isMine = false;
            return (
              <SelectItem
                className="flex justify-between text-sm w-full"
                key={index}
                value={army.entity_id?.toString() || ""}
              >
                <ArmyChip className={`w-[27rem] bg-green/10`} army={army} />
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
};
const checkWhatToShow = (
  battle: BattleInfo | undefined,
  selectedEntity:
    | {
        id: bigint;
        position: Position;
      }
    | undefined,
  clickedHex: ClickedHex | undefined,
  userAttackingArmies: ArmyInfo[],
  enemyArmies: ArmyInfo[],
  structure: Structure | undefined,
): ToShow => {
  if (battle) {
    return {
      showSelectableUnits: false,
      showEnnemies: false,
      showStructure: false,
    };
  } else {
    if (selectedEntity) {
      if (structure) {
        return {
          showSelectableUnits: true,
          showEnnemies: false,
          showStructure: true && Boolean(structure),
        };
      } else {
        return {
          showSelectableUnits: true,
          showEnnemies: true && enemyArmies.length > 0,
          showStructure: false,
        };
      }
    } else {
      if (clickedHex && userAttackingArmies.length > 0) {
        if (structure) {
          return {
            showSelectableUnits: true,
            showEnnemies: false,
            showStructure: true && Boolean(structure),
          };
        } else {
          return {
            showSelectableUnits: true,
            showEnnemies: true && enemyArmies.length > 0,
            showStructure: false,
          };
        }
      } else {
        return {
          showSelectableUnits: false,
          showEnnemies: true && enemyArmies.length > 0,
          showStructure: true && Boolean(structure),
        };
      }
    }
  }
};
