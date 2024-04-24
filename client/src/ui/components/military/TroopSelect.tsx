import { useDojo } from "@/hooks/context/DojoContext";
import { useResourceBalance } from "@/hooks/helpers/useResources";
import Button from "@/ui/elements/Button";
import TextInput from "@/ui/elements/TextInput";
import { useEffect, useMemo, useState } from "react";

const nameMapping: { [key: number]: string } = {
  250: "Knight",
  251: "Crossbowman",
  252: "Paladin",
};

const troops = [
  { name: 250, cost: 10, attack: 10, defense: 10, strong: "Cavalry", weak: "Archers" },
  { name: 251, cost: 10, attack: 15, defense: 5, strong: "Swordsmen", weak: "Cavalry" },
  { name: 252, cost: 10, attack: 20, defense: 0, strong: "Archers", weak: "Swordsmen" },
];

export const TroopSelect = ({ entity }: any) => {
  const {
    account: { account },
    setup: {
      systemCalls: { create_army },
    },
  } = useDojo();

  const [isLoading, setIsLoading] = useState(false);
  const [canCreate, setCanCreate] = useState(false);
  const [troopCounts, setTroopCounts] = useState<{ [key: number]: number }>({
    250: 1,
    251: 1,
    252: 1,
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
    setIsLoading(true);
    create_army({
      signer: account,
      owner_id: entity.entity_id,
      troops: {
        knight_count: troopCounts[250] || 0,
        paladin_count: troopCounts[251] || 0,
        crossbowman_count: troopCounts[252] || 0,
      },
    }).finally(() => setIsLoading(false));
  };

  const { getBalance } = useResourceBalance();

  useEffect(() => {
    let canCreate = true;
    Object.keys(troopCounts).forEach((troopId) => {
      const count = troopCounts[Number(troopId)];
      const balance = getBalance(entity.entity_id, Number(troopId)).balance;
      if (count > balance) {
        canCreate = false;
      }
    });
    setCanCreate(canCreate);
  }, [troopCounts]);

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
            <div>Balance: {getBalance(entity.entity_id, troop.name).balance}</div>
          </div>
        ))}
      </div>
      {/* <div>
        <div>Total Cost</div>
        <div>{calculateTotalCost()}</div>
      </div> */}
      <Button disabled={!canCreate} variant="outline" isLoading={isLoading} onClick={handleCreateArmy}>
        Create Army
      </Button>
    </div>
  );
};
