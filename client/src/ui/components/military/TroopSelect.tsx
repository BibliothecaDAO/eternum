import { useDojo } from "@/hooks/context/DojoContext";
import Button from "@/ui/elements/Button";
import TextInput from "@/ui/elements/TextInput";
import { useState } from "react";

const nameMapping: { [key: number]: string } = {
  1: "Knight",
  2: "Paladin",
  3: "Crossbowman",
};

const troops = [
  { name: 1, cost: 10, attack: 10, defense: 10, strong: "Cavalry", weak: "Archers" },
  { name: 2, cost: 10, attack: 15, defense: 5, strong: "Swordsmen", weak: "Cavalry" },
  { name: 3, cost: 10, attack: 20, defense: 0, strong: "Archers", weak: "Swordsmen" },
];

export const TroopSelect = ({ entity }: any) => {
  const {
    account: { account },
    setup: {
      systemCalls: { create_army },
    },
  } = useDojo();

  const [troopCounts, setTroopCounts] = useState<{ [key: number]: number }>({
    1: 1,
    2: 1,
    3: 1,
  });

  const handleTroopCountChange = (troopName: number, count: number) => {
    setTroopCounts((prev) => ({ ...prev, [troopName]: count }));
  };

  const calculateTotalCost = () => {
    return troops.reduce((total, troop) => {
      return total + troop.cost * troopCounts[troop.name];
    }, 0);
  };

  console.log(entity.entity_id);

  const handleCreateArmy = () => {
    create_army({
      signer: account,
      owner_id: entity.entity_id,
      troops: {
        knight_count: troopCounts[1] || 0,
        paladin_count: troopCounts[2] || 0,
        crossbowman_count: troopCounts[3] || 0,
      },
    });
  };

  return (
    <div>
      <h4>New Army</h4>
      <div className="grid grid-cols-3 gap-2">
        {troops.map((troop) => (
          <div className="p-2 border" key={troop.name}>
            <div className="font-bold">{nameMapping[troop.name]}</div>
            <div>Cost: {troop.cost}</div>
            <div>Strong: {troop.strong}</div>
            <div>Weak: {troop.weak}</div>
            <div>Atk: {troop.attack}</div>
            <div>Def: {troop.defense}</div>

            <TextInput
              className="border"
              value={troopCounts[troop.name].toString()}
              onChange={(amount) => handleTroopCountChange(troop.name, parseInt(amount))}
            />
          </div>
        ))}
      </div>
      <div>
        <div>Total Cost</div>
        <div>{calculateTotalCost()}</div>
      </div>
      <Button variant="outline" onClick={handleCreateArmy}>
        Create Army
      </Button>
    </div>
  );
};
