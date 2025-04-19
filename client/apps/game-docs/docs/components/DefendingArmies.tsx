import { section, table } from "./styles";

// Component 1: Total Armies by Realm Level
export const TotalArmiesTable = () => {
  const realmLevelArmies = [
    { level: "Settlement", totalArmies: 2 },
    { level: "City", totalArmies: 3 },
    { level: "Kingdom", totalArmies: 5 },
    { level: "Empire", totalArmies: 7 },
  ];

  return (
    <div style={section.wrapper}>
      <div style={section.accentedTitle}>
        <span style={{ marginRight: "0.5rem" }}>🏰</span>Total Armies by Realm Level
      </div>
      <div style={table.container}>
        <table style={table.table}>
          <thead style={table.tableHead}>
            <tr>
              <th style={table.headerCell}>Realm / Village Level</th>
              <th style={table.headerCell}>Base No. Total Armies</th>
            </tr>
          </thead>
          <tbody>
            {realmLevelArmies.map((item) => (
              <tr key={item.level}>
                <td style={table.cell}>{item.level}</td>
                <td style={{ ...table.cell, color: "#f0b060", fontWeight: "bold" }}>{item.totalArmies}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Component 2: Defense Slots by Realm Level
export const RealmDefenseSlotsTable = () => {
  const defenseSlots = [
    { level: "Settlement", slots: 1 },
    { level: "City", slots: 2 },
    { level: "Kingdom", slots: 3 },
    { level: "Empire", slots: 4 },
  ];

  return (
    <div style={section.wrapper}>
      <div style={section.accentedTitle}>
        <span style={{ marginRight: "0.5rem" }}>🛡️</span>Defense Slots by Realm Level
      </div>
      <div style={table.container}>
        <table style={table.table}>
          <thead style={table.tableHead}>
            <tr>
              <th style={table.headerCell}>Realm / Village Level</th>
              <th style={table.headerCell}>No. Defense Slots</th>
            </tr>
          </thead>
          <tbody>
            {defenseSlots.map((item) => (
              <tr key={item.level}>
                <td style={table.cell}>{item.level}</td>
                <td style={{ ...table.cell, color: "#f0b060", fontWeight: "bold" }}>{item.slots}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Component 3: Defense Slots by Structure Type
export const WorldStructureDefenseSlotsTable = () => {
  const worldStructures = [
    { structure: "Fragment Mine", slots: 1 },
    { structure: "Hyperstructure Foundation", slots: 2 },
    { structure: "Hyperstructure (complete)", slots: 4 },
    { structure: "Bank", slots: 4 },
  ];

  return (
    <div style={section.wrapper}>
      <div style={section.accentedTitle}>
        <span style={{ marginRight: "0.5rem" }}>🏛️</span>Defense Slots by Structure Type
      </div>
      <div style={table.container}>
        <table style={table.table}>
          <thead style={table.tableHead}>
            <tr>
              <th style={table.headerCell}>World Structure</th>
              <th style={table.headerCell}>No. Defense Slots</th>
            </tr>
          </thead>
          <tbody>
            {worldStructures.map((item) => (
              <tr key={item.structure}>
                <td style={table.cell}>{item.structure}</td>
                <td style={{ ...table.cell, color: "#f0b060", fontWeight: "bold" }}>{item.slots}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
