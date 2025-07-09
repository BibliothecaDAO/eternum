import { section, table } from "./styles";

export const StorageTable = () => {
  const structures = [
    { type: "Hyperstructure", capacity: "20,000 kg" },
    { type: "Essence Rift", capacity: "5,000 kg" },
    { type: "Camp", capacity: "20,000 kg" },
  ];

  return (
    <div style={section.wrapper}>
      <div style={section.accentedTitle}>World Structure Storage</div>

      <div style={table.container}>
        <table style={table.table}>
          <thead style={table.tableHead}>
            <tr>
              <th style={table.headerCell}>Structure Type</th>
              <th style={table.headerCell}>Storage Capacity</th>
            </tr>
          </thead>
          <tbody>
            {structures.map((structure, index) => (
              <tr key={index}>
                <td style={table.cell}>{structure.type}</td>
                <td style={table.cell}>{structure.capacity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
