import { usePositionArmies } from "@/hooks/helpers/useArmies";
import useUIStore from "@/hooks/store/useUIStore";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/elements/Select";
import { useMemo } from "react";
import { ArmiesAtLocation } from "../../military/Battle";
import { StructureCard } from "../../hyperstructures/StructureCard";

export const HexagonInformationPanel = () => {
  const { clickedHex, selectedEntity, setSelectedEntity } = useUIStore(
    ({ clickedHex, selectedEntity, setSelectedEntity }) => ({
      clickedHex,
      selectedEntity,
      setSelectedEntity,
    }),
  );

  const position = useMemo(() => {
    if (selectedEntity) return { x: selectedEntity.position.x, y: selectedEntity.position.y };
    if (clickedHex) return { x: clickedHex.contractPos.col, y: clickedHex.contractPos.row };
  }, [clickedHex, selectedEntity]);

  const { userArmies, enemyArmies } = usePositionArmies({
    position: { x: position?.x || 0, y: position?.y || 0 },
  });

  const panelSelectedEntity = useMemo(() => {
    if (selectedEntity) return selectedEntity;
    if (userArmies.length > 0 && clickedHex) {
      const entity = {
        id: BigInt(userArmies[0].entity_id),
        position: { x: clickedHex.contractPos.col, y: clickedHex.contractPos.row },
      };
      setSelectedEntity(entity);
      return entity;
    }
    return selectedEntity;
  }, [clickedHex]);

  const ownArmySelected = useMemo(() => {
    if (!selectedEntity) return;
    return userArmies.find((army) => BigInt(army.entity_id) === selectedEntity.id);
  }, [userArmies, selectedEntity]);

  return (
    position && (
      <div className="p-2">
        <div className="p-2 flex justify-between">
          <h5>Coordinates</h5>
          <div className=" font-bold flex  space-x-2 justify-between self-center ">
            <div>{`x: ${position!.x?.toLocaleString()}`}</div>
            <div>{`y: ${position!.y?.toLocaleString()}`}</div>
          </div>
        </div>
        {panelSelectedEntity && (
          <div className="self-center flex flex-col justify-between w-full">
            <div className=" p-2">Select Army for battle</div>
            <Select
              value={panelSelectedEntity?.id.toString()}
              onValueChange={(a: string) => {
                setSelectedEntity({ id: BigInt(a), position });
              }}
            >
              <SelectTrigger className="">
                <SelectValue placeholder="Your armies" />
              </SelectTrigger>
              <SelectContent className="bg-brown text-gold">
                {userArmies.map((army, index) => (
                  <SelectItem
                    className="flex justify-between text-sm"
                    key={index}
                    value={army.entity_id?.toString() || ""}
                  >
                    <h5 className="self-center flex gap-4">{army.name}</h5>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <StructureCard position={position} ownArmySelected={ownArmySelected} />
        <ArmiesAtLocation armies={enemyArmies} ownArmy={ownArmySelected} />
      </div>
    )
  );
};

export default HexagonInformationPanel;
