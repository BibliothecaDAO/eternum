import { GUARD_SLOT_NAMES } from "@bibliothecadao/types";
import { colors, section, table } from "../styles";

// Component 2b: Blitz Defense Slots by Realm Level
export const BlitzRealmDefenseSlotsTable = () => {
  const defenseSlots = [
    { level: "Settlement", fieldSlots: 1, guardSlots: 1, slotName: GUARD_SLOT_NAMES[0] },
    { level: "City", fieldSlots: 3, guardSlots: 2, slotName: GUARD_SLOT_NAMES[1] },
    { level: "Kingdom", fieldSlots: 5, guardSlots: 3, slotName: GUARD_SLOT_NAMES[2] },
    { level: "Empire", fieldSlots: 8, guardSlots: 4, slotName: GUARD_SLOT_NAMES[3] },
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
              <th style={table.headerCell}>Realm Level</th>
              <th style={table.headerCell}>No. Field Armies</th>
              <th style={table.headerCell}>No. Guard Armies</th>
              <th style={table.headerCell}>Defense Slot Name</th>
            </tr>
          </thead>
          <tbody>
            {defenseSlots.map((item) => (
              <tr key={item.level}>
                <td style={table.cell}>{item.level}</td>
                <td style={{ ...table.cell, color: colors.primary, fontWeight: "bold" }}>{item.fieldSlots}</td>
                <td style={{ ...table.cell, color: colors.primary, fontWeight: "bold" }}>{item.guardSlots}</td>
                <td style={table.cell}>{item.slotName}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Component: Blitz World Structure Defense Slots Table (Hardcoded)
export const BlitzWorldStructureDefenseSlotsTable = () => {
  const worldStructures = [
    { structure: "Camp", guardSlots: 1 },
    { structure: "Essence Rift", guardSlots: 1 },
    { structure: "Hyperstructure", guardSlots: 4 },
  ];

  return (
    <div style={section.wrapper}>
      <div style={section.accentedTitle}>
        <span style={{ fontSize: "0.85em", fontWeight: 400 }}>Guard Slots by Structure Type</span>
      </div>
      <div style={table.container}>
        <table style={table.table}>
          <thead style={table.tableHead}>
            <tr>
              <th style={table.headerCell}>World Structure</th>
              <th style={table.headerCell}>Guard Slots</th>
            </tr>
          </thead>
          <tbody>
            {worldStructures.map((item) => (
              <tr key={item.structure}>
                <td style={table.cell}>{item.structure}</td>
                <td style={{ ...table.cell, color: colors.primary, fontWeight: "bold" }}>{item.guardSlots}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
