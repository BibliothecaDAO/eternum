// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("StructureListColumn sizing", () => {
  it("shares the compact panel height and scrolls additional structures", () => {
    const columnSource = readSource("src/ui/features/world/containers/left-facets/structure-list-column.tsx");
    const rowSource = readSource("src/ui/features/world/components/structure-status-row/structure-status-row.tsx");

    expect(columnSource).toContain("HUD_SECTION_HEIGHT");
    expect(columnSource).toContain("overflow-y-auto");
    expect(rowSource).toContain('isFull && "h-[60px]"');
  });
});
