import Button from "@/ui/elements/Button";

const troops = [
  { name: "Swordsmen", cost: 100, attack: 10, defense: 10, strong: "Cavalry", weak: "Archers" },
  { name: "Archers", cost: 150, attack: 15, defense: 5, strong: "Swordsmen", weak: "Cavalry" },
  { name: "Cavalry", cost: 200, attack: 20, defense: 0, strong: "Archers", weak: "Swordsmen" },
];

export const TroopSelect = () => {
  return (
    <div className="">
      <h4>Build new Army</h4>
      <div className="grid grid-cols-3 gap-2">
        {troops.map((troop) => (
          <div className=" p-2 border " key={troop.name}>
            <div className="font-bold">{troop.name}</div>
            {/* <div>{troop.cost}</div> */}
            <div>Strong: {troop.strong}</div>
            <div>Weak: {troop.weak}</div>
            <div>Atk: {troop.attack}</div>
            <div>Def: {troop.defense}</div>
          </div>
        ))}
      </div>
      <div>
        <div>Cost</div>
        <div>DISPLAY COST</div>
      </div>
      <Button variant="outline" onClick={() => console.log("")}>
        {" "}
        Enlist Army
      </Button>
    </div>
  );
};
