// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("StructureListColumn sizing", () => {
  it("caps the left rail structure list to three fixed rows before scrolling", () => {
    const columnSource = readSource("src/ui/features/world/containers/left-facets/structure-list-column.tsx");
    const rowSource = readSource("src/ui/features/world/components/structure-status-row/structure-status-row.tsx");

    expect(columnSource).toContain("const STRUCTURE_LIST_VISIBLE_ROWS = 3;");
    expect(columnSource).toContain("STRUCTURE_LIST_MAX_HEIGHT_PX");
    expect(columnSource).toContain("style={{ maxHeight: `${STRUCTURE_LIST_MAX_HEIGHT_PX}px` }}");
    expect(columnSource).not.toContain("36vh");
    expect(rowSource).toContain('isFull && "h-[60px]"');
  });
});
