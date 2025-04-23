import { DEFENSE_NAMES } from "@bibliothecadao/types";
import { section, table } from "./styles";

// Component 1: Total Armies by Realm Level
export const TotalArmiesTable = () => {
  const realmLevelArmies = [
    { level: "Settlement", totalArmies: 2 },
    { level: "City", totalArmies: 4 },
    { level: "Kingdom", totalArmies: 6 },
    { level: "Empire", totalArmies: 8 },
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
    { level: "Settlement", slots: 1, slotName: DEFENSE_NAMES[0] },
    { level: "City", slots: 2, slotName: DEFENSE_NAMES[1] },
    { level: "Kingdom", slots: 3, slotName: DEFENSE_NAMES[2] },
    { level: "Empire", slots: 4, slotName: DEFENSE_NAMES[3] },
  ];

  return (
    <div style={section.wrapper}>
      <div style={section.accentedTitle}>
        <span style={{ marginRight: "0.5rem" }}>🛡️</span>Guard Slots by Realm Level
      </div>
      <div style={table.container}>
        <table style={table.table}>
          <thead style={table.tableHead}>
            <tr>
              <th style={table.headerCell}>Realm / Village Level</th>
              <th style={table.headerCell}>No. Guard Slots</th>
              <th style={table.headerCell}>Slot Name</th>
            </tr>
          </thead>
          <tbody>
            {defenseSlots.map((item) => (
              <tr key={item.level}>
                <td style={table.cell}>{item.level}</td>
                <td style={{ ...table.cell, color: "#f0b060", fontWeight: "bold" }}>{item.slots}</td>
                <td style={table.cell}>{item.slotName}</td>
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
    { structure: "Fragment Mine", guardSlots: 1, fieldSlots: 0 },
    { structure: "Hyperstructure", guardSlots: 4, fieldSlots: 0 },
    { structure: "Bank", guardSlots: 4, fieldSlots: 0 },
    { structure: "Village", guardSlots: 1, fieldSlots: 1 },
    { structure: "Realm", guardSlots: 1, fieldSlots: 1 },
  ];

  return (
    <div style={section.wrapper}>
      <div style={section.accentedTitle}>
        <span style={{ marginRight: "0.5rem" }}>🏛️</span>Troop Slots by Structure Type
      </div>
      <div style={table.container}>
        <table style={table.table}>
          <thead style={table.tableHead}>
            <tr>
              <th style={table.headerCell}>World Structure</th>
              <th style={table.headerCell}>Guard Slots</th>
              <th style={table.headerCell}>Field Troop Slots</th>
            </tr>
          </thead>
          <tbody>
            {worldStructures.map((item) => (
              <tr key={item.structure}>
                <td style={table.cell}>{item.structure}</td>
                <td style={{ ...table.cell, color: "#f0b060", fontWeight: "bold" }}>{item.guardSlots}</td>
                <td style={{ ...table.cell, color: "#f0b060", fontWeight: "bold" }}>{item.fieldSlots}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
