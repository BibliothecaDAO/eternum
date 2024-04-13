import Button from "@/ui/elements/Button";
import { EntityList } from "../list/EntityList";

const exampleArmies = [
  { id: 1, name: "Army 1" },
  { id: 2, name: "Army 2" },
  { id: 3, name: "Army 3" },
];

export const ArmyList = () => {
  return <EntityList list={exampleArmies} title="armies" panel={({ entity }) => <ArmyCard entity={entity} />} />;
};

export const ArmyCard = ({ entity }: any) => {
  return (
    <div>
      <div className="text-2xl">{entity.name}</div>
      <ArmyStatistics />
      <TroopCard />
      <div>Resources</div>

      <div className="mt-8">
        <Button onClick={() => console.log("")} variant="outline">
          Add
        </Button>
        <Button onClick={() => console.log("")} variant="outline">
          Combine
        </Button>
      </div>
    </div>
  );
};

export const TroopCard = ({}) => {
  const troops = [
    { id: 1, name: "Knights", quantity: 10 },
    { id: 2, name: "Crossbowmen", quantity: 10 },
    { id: 3, name: "Paladin", quantity: 10 },
  ];
  return (
    <div className="grid grid-cols-3 gap-4">
      {troops.map((troop) => (
        <div className="border p-3">
          {troop.name} - {troop.quantity}
        </div>
      ))}
    </div>
  );
};

export const ArmyStatistics = ({}) => {
  return (
    <div className="flex space-x-4 ">
      <div>Atk: 30</div>
      <div>Def: 30</div>
      <div>HP: 30</div>
    </div>
  );
};
