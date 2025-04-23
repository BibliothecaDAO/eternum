import { colors, table } from "./styles";

export const EfficiencyTable = () => {
  const efficiencyData = [
    { hyperstructures: 0, resourceEfficiency: 25, troopEfficiency: 0 },
    { hyperstructures: 1, resourceEfficiency: 50, troopEfficiency: 25 },
    { hyperstructures: 2, resourceEfficiency: 70, troopEfficiency: 50 },
    { hyperstructures: 3, resourceEfficiency: 85, troopEfficiency: 70 },
    { hyperstructures: 5, resourceEfficiency: 95, troopEfficiency: 85 },
    { hyperstructures: 7, resourceEfficiency: 95, troopEfficiency: 95 },
  ];

  return (
    <div style={table.container}>
      <div style={table.wrapper}>
        <table style={table.table}>
          <thead style={table.tableHead}>
            <tr>
              <th style={table.headerCell}>Hyperstructures Completed</th>
              <th style={table.headerCell}>Resource Bridging Efficiency</th>
              <th style={table.headerCell}>Troop Bridging Efficiency</th>
            </tr>
          </thead>
          <tbody>
            {efficiencyData.map((row, index) => (
              <tr key={index}>
                <td style={table.cell}>{row.hyperstructures}</td>
                <td style={table.cell}>
                  <span style={{ color: colors.modifiers.positive }}>{row.resourceEfficiency}%</span>
                </td>
                <td style={table.cell}>
                  <span style={{ color: colors.modifiers.positive }}>{row.troopEfficiency}%</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
