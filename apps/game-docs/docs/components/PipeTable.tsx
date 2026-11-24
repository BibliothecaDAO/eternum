export function PipeTable({ headers, children }: { headers: readonly string[]; children: string }) {
  const rows = children
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => line.split(" | "));
  return (
    <table>
      <thead>
        <tr>
          {headers.map((header) => (
            <th key={header}>{header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((cells, rowIndex) => (
          <tr key={cells[0] ?? rowIndex}>
            {cells.map((cell, cellIndex) => (
              <td key={cellIndex}>{cellIndex === 1 ? <strong>{cell}</strong> : cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
