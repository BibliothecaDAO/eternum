import { ArmyInfo, usePositionArmies } from "@/hooks/helpers/useArmies";
import { useBattlesByPosition } from "@/hooks/helpers/useBattles";
import { Structure, useStructuresPosition } from "@/hooks/helpers/useStructures";
import useUIStore from "@/hooks/store/useUIStore";
import { ClickedHex } from "@/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/elements/Select";
import { Position } from "@bibliothecadao/eternum";
import { useMemo, useState } from "react";
import { StructureCard } from "../../hyperstructures/StructureCard";
import { EnemyArmies } from "../../military/Battle";

type ToShow = {
  showBattle: boolean;
  showSelectableUnits: boolean;
  showEnnemies: boolean;
  showStructure: boolean;
};

export const HexagonInformationPanel = () => {
  const clickedHex = useUIStore((state) => state.clickedHex);
  const selectedEntity = useUIStore((state) => state.selectedEntity);
  const [ownArmySelected, setOwnArmySelected] = useState(selectedEntity);

  const hexPosition = useMemo(() => {
    if (selectedEntity) return { x: selectedEntity.position.x, y: selectedEntity.position.y };
    if (clickedHex) return { x: clickedHex.contractPos.col, y: clickedHex.contractPos.row };
  }, [clickedHex, selectedEntity]);

  const battle = useBattlesByPosition(hexPosition || { x: 0, y: 0 });

  const { formattedStructureAtPosition } = useStructuresPosition({ position: hexPosition || { x: 0, y: 0 } });

  const { userAttackingArmies, enemyArmies } = usePositionArmies({
    position: { x: hexPosition?.x || 0, y: hexPosition?.y || 0 },
  });

  const panelSelectedEntity = useMemo(() => {
    if (selectedEntity) return selectedEntity;
    if (userAttackingArmies.length > 0 && clickedHex && enemyArmies.length > 0) {
      const entity = {
        id: BigInt(userAttackingArmies[0].entity_id),
        position: { x: clickedHex.contractPos.col, y: clickedHex.contractPos.row },
      };
      setOwnArmySelected(entity);
      return entity;
    }
  }, [clickedHex]);

  const ownArmy = useMemo(() => {
    if (!ownArmySelected) return;
    return userAttackingArmies.find((army) => BigInt(army.entity_id) === ownArmySelected.id);
  }, [userAttackingArmies, selectedEntity]);

  const toShow = checkWhatToShow(
    battle,
    ownArmySelected,
    clickedHex,
    userAttackingArmies,
    enemyArmies,
    formattedStructureAtPosition,
  );

  return (
    hexPosition && (
      <div className="p-2">
        <Coordinates position={hexPosition} />
        {toShow.showSelectableUnits && (
          <SelectActiveArmy
            selectedEntity={panelSelectedEntity}
            setOwnArmySelected={setOwnArmySelected}
            userAttackingArmies={userAttackingArmies}
          />
        )}
        {toShow.showBattle && <div>Hello World</div>}
        {toShow.showStructure && <StructureCard position={hexPosition} ownArmySelected={ownArmy} />}
        {toShow.showEnnemies && <EnemyArmies armies={enemyArmies} ownArmySelected={ownArmy!} />}
        {!toShow.showBattle && !toShow.showEnnemies && !toShow.showStructure && "Nothing to show here"}
      </div>
    )
  );
};

export default HexagonInformationPanel;

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
  return (
    <div className="self-center flex flex-col justify-between w-full">
      <Select
        value={selectedEntity?.id.toString() || ""}
        onValueChange={(a: string) => {
          setOwnArmySelected({ id: BigInt(a), position: selectedEntity?.position || 0n });
        }}
      >
        <SelectTrigger className="">
          <SelectValue placeholder="Your armies" />
        </SelectTrigger>
        <SelectContent className="bg-brown text-gold">
          {userAttackingArmies.map((army, index) => (
            <SelectItem className="flex justify-between text-sm" key={index} value={army.entity_id?.toString() || ""}>
              <h5 className="self-center flex gap-4">{army.name}</h5>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

const checkWhatToShow = (
  battle: bigint | undefined,
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
    if (selectedEntity || (clickedHex && userAttackingArmies.length > 0)) {
      return { showBattle: true, showSelectableUnits: true, showEnnemies: false, showStructure: false };
    }
    return {
      showBattle: true,
      showSelectableUnits: false,
      showEnnemies: true,
      showStructure: true && Boolean(structure),
    };
  } else {
    if (selectedEntity) {
      if (structure) {
        return {
          showBattle: false,
          showSelectableUnits: true,
          showEnnemies: false,
          showStructure: true && Boolean(structure),
        };
      } else {
        return {
          showBattle: false,
          showSelectableUnits: true,
          showEnnemies: true && enemyArmies.length > 0,
          showStructure: false,
        };
      }
    } else {
      if (clickedHex && userAttackingArmies.length > 0) {
        if (structure) {
          return {
            showBattle: false,
            showSelectableUnits: true,
            showEnnemies: false,
            showStructure: true && Boolean(structure),
          };
        } else {
          return {
            showBattle: false,
            showSelectableUnits: true,
            showEnnemies: true && enemyArmies.length > 0,
            showStructure: false,
          };
        }
      } else {
        return {
          showBattle: false,
          showSelectableUnits: false,
          showEnnemies: true && enemyArmies.length > 0,
          showStructure: true && Boolean(structure),
        };
      }
    }
  }
};
