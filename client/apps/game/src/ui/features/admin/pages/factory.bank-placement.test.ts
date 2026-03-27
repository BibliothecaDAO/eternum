import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("Factory bank placement", () => {
  it("builds banks from the indexed map_center_offset helper instead of the fixed HexGrid center", () => {
    const source = readFileSync(resolve(process.cwd(), "src/ui/features/admin/pages/factory.tsx"), "utf8");

    expect(source).toContain("fetchWorldMapCenterOffset(name)");
    expect(source).toContain("buildAdminBanksForMapCenterOffset(mapCenterOffset)");
    expect(source).not.toContain("HexGrid.findHexCoordsfromCenter(BANK_STEPS_FROM_CENTER)");
  });
});
