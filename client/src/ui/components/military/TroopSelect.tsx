import { useDojo } from "@/hooks/context/DojoContext";
import { useResourceBalance } from "@/hooks/helpers/useResources";
import Button from "@/ui/elements/Button";
import TextInput from "@/ui/elements/TextInput";
import { currencyFormat } from "@/ui/utils/utils";
import { ResourcesIds } from "@bibliothecadao/eternum";
import { useEffect, useState } from "react";

const nameMapping: { [key: number]: string } = {
  [ResourcesIds.Knight]: "Knight",
  [ResourcesIds.Crossbowmen]: "Crossbowman",
  [ResourcesIds.Paladin]: "Paladin",
};

const troops = [
  { name: ResourcesIds.Knight, cost: 10, attack: 10, defense: 10, strong: "Cavalry", weak: "Archers" },
  { name: ResourcesIds.Crossbowmen, cost: 10, attack: 10, defense: 10, strong: "Swordsmen", weak: "Cavalry" },
  { name: ResourcesIds.Paladin, cost: 10, attack: 10, defense: 10, strong: "Archers", weak: "Swordsmen" },
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
    [ResourcesIds.Knight]: 1,
    [ResourcesIds.Crossbowmen]: 1,
    [ResourcesIds.Paladin]: 1,
  });

  const handleTroopCountChange = (troopName: number, count: number) => {
    setTroopCounts((prev) => ({ ...prev, [troopName]: count }));
  };

  const calculateTotalCost = () => {
    return troops.reduce((total, troop) => {
      return total + troop.cost * troopCounts[troop.name];
    }, 0);
  };

  const handleCreateArmy = () => {
    setIsLoading(true);
    create_army({
      signer: account,
      army_owner_id: entity.entity_id,
      army_is_protector: false,
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
      <h4 className="my-5">New Army</h4>
      <StepOne />
      <div className="grid grid-cols-3 gap-2">
        {troops.map((troop) => (
          <div className="p-2 border" key={troop.name}>
            <h5 className="font-bold">{nameMapping[troop.name]}</h5>
            <div>
              Available:{" "}
              {currencyFormat(
                getBalance(entity.entity_id, troop.name).balance
                  ? Number(getBalance(entity.entity_id, troop.name).balance)
                  : 0,
                2,
              )}{" "}
              {}
            </div>
            <div>Str vs {troop.strong}</div>
            <div>Wk vs {troop.weak}</div>
            <div className="flex justify-between border px-2 uppercase">
              <div>Atk: {troop.attack}</div>
              <div>Def: {troop.defense}</div>
            </div>

            <div className="flex border">
              <div className="self-center px-3">amount:</div>
              <TextInput
                className="border"
                value={troopCounts[troop.name].toString()}
                onChange={(amount) => handleTroopCountChange(troop.name, parseInt(amount))}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mb-3 border p-2">
        <h4>Enlisting</h4>
        <div>
          {nameMapping[ResourcesIds.Knight]}: {troopCounts[ResourcesIds.Knight]}
        </div>
        <div>
          {nameMapping[ResourcesIds.Crossbowmen]}: {troopCounts[ResourcesIds.Crossbowmen]}
        </div>
        <div>
          {nameMapping[ResourcesIds.Paladin]}: {troopCounts[ResourcesIds.Paladin]}
        </div>
      </div>
      <hr />
      <Button
        className="w-full "
        disabled={!canCreate}
        variant="primary"
        isLoading={isLoading}
        onClick={handleCreateArmy}
      >
        Create Army
      </Button>
    </div>
  );
};

export const StepOne = () => {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="border h-32">
        <Button onClick={() => console.log()}>Create Defending Army</Button>
      </div>
      <div className="border h-32">
        <Button onClick={() => console.log()}>Create Attacking Army</Button>
      </div>
    </div>
  );
};
