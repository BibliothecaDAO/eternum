const troops = [
  { name: "Swordsmen", cost: 100, attack: 10, defense: 10 },
  { name: "Archers", cost: 150, attack: 15, defense: 5 },
  { name: "Cavalry", cost: 200, attack: 20, defense: 0 },
];

export const TroopSelect = () => {
  return (
    <div className="">
      <h2>Troops</h2>
      <ul>
        {troops.map((troop) => (
          <li className="text-xl my-1 border-b flex justify-between" key={troop.name}>
            <div>{troop.name}</div>
            <div>{troop.cost}</div>
            <div>{troop.attack}</div>
            <div>{troop.defense}</div>
          </li>
        ))}
      </ul>
    </div>
  );
};
