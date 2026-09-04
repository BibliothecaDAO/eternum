import { section, table } from "./styles";

export const BuildableHexes = () => {
  const buildableHexes = [
    { level: "Settlement", hexes: 6, description: "A small settlement with a few buildings." },
    { level: "City", hexes: 18, description: "A glorious city with many districts." },
    { level: "Kingdom", hexes: 36, description: "A kingdom with many cities and towns." },
    { level: "Empire", hexes: 60, description: "A vast empire with many kingdoms and cities." },
  ];

  return (
    <div style={section.wrapper}>
      <div style={section.accentedTitle}>Buildable Hexes by Realm Level</div>
      <div style={table.container}>
        <table style={table.table}>
          <thead style={table.tableHead}>
            <tr>
              <th style={table.headerCell}>Realm Level</th>
              <th style={{ ...table.headerCell, textAlign: "center" }}>Buildable Hexes</th>
              <th style={table.headerCell}>Description</th>
            </tr>
          </thead>
          <tbody>
            {buildableHexes.map((item) => (
              <tr key={item.level}>
                <td style={table.cell}>{item.level}</td>
                <td style={{ ...table.cell, color: table.headerCell.color, fontWeight: "bold", textAlign: "center" }}>
                  {item.hexes}
                </td>
                <td style={table.cell}>{item.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
