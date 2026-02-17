import { GUARD_SLOT_NAMES } from "@bibliothecadao/types";
import { colors, section, table } from "../styles";


export const RealmDefenseSlotsTable = () => {
  const defenseSlots = [
    { level: "Settlement", slots: 1, slotName: GUARD_SLOT_NAMES[0] },
    { level: "City", slots: 2, slotName: GUARD_SLOT_NAMES[1] },
    { level: "Kingdom", slots: 3, slotName: GUARD_SLOT_NAMES[2] },
    { level: "Empire", slots: 4, slotName: GUARD_SLOT_NAMES[3] },
  ];

  return (
    <div style={section.wrapper}>
      <div style={section.accentedTitle}>
        <span style={{ fontSize: "0.85em", fontWeight: 400 }}>Armies by Realm Level</span>
      </div>
      <div style={table.container}>
        <table style={table.table}>
          <thead style={table.tableHead}>
            <tr>
              <th style={table.headerCell}>Realm / Village Level</th>
              <th style={table.headerCell}>No. Guard Armies</th>
              <th style={table.headerCell}>Slot Name</th>
              <th style={table.headerCell}>No. Field Armies</th>
            </tr>
          </thead>
          <tbody>
            {defenseSlots.map((item) => (
              <tr key={item.level}>
                <td style={table.cell}>{item.level}</td>
                <td style={{ ...table.cell, color: colors.primary, fontWeight: "bold" }}>{item.slots}</td>
                <td style={table.cell}>{item.slotName}</td>
                <td style={{ ...table.cell, color: colors.primary, fontWeight: "bold" }}>{item.slots}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Component 2b: Blitz Defense Slots by Realm Level

export const WorldStructureDefenseSlotsTable = () => {
  const worldStructures = [
    { structure: "Fragment Mine", guardSlots: 1, fieldSlots: 0 },
    { structure: "Hyperstructure", guardSlots: 4, fieldSlots: 0 },
    { structure: "Bank", guardSlots: 4, fieldSlots: 0 },
  ];

  return (
    <div style={section.wrapper}>
      <div style={section.accentedTitle}>
        <span style={{ fontSize: "0.85em", fontWeight: 400 }}>Troop Slots by Structure Type</span>
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
                <td style={{ ...table.cell, color: colors.primary, fontWeight: "bold" }}>{item.guardSlots}</td>
                <td style={{ ...table.cell, color: colors.primary, fontWeight: "bold" }}>{item.fieldSlots}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Component: Blitz World Structure Defense Slots Table (Hardcoded)
