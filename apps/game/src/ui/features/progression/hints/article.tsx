import { HudTableHead, HudTableRow } from "@/ui/design-system/kit/hud-elements";
import type { ReactNode } from "react";

/** A table a Lordpedia page reads out: its column names over rows that are only read, all on one grid. */
export const ReferenceTable = ({
  label,
  cols,
  head,
  rows,
}: {
  label: string;
  cols: string;
  head: readonly ReactNode[];
  rows: readonly { key: string | number; label: string; cells: readonly ReactNode[] }[];
}) => (
  <div role="table" aria-label={label}>
    <HudTableHead cols={cols}>
      {head.map((name, index) => (
        <span key={index} role="columnheader">
          {name}
        </span>
      ))}
    </HudTableHead>
    {rows.map((row) => (
      <HudTableRow key={row.key} cols={cols} label={row.label}>
        {row.cells.map((cell, index) => (
          <span key={index} role="cell">
            {cell}
          </span>
        ))}
      </HudTableRow>
    ))}
  </div>
);
