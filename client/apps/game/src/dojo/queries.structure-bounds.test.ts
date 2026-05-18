import { getEntities } from "@dojoengine/state";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getStructuresFromToriiExact } from "./queries";

vi.mock("@dojoengine/state", () => ({
  getEntities: vi.fn().mockResolvedValue([]),
}));

describe("getStructuresFromToriiExact", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("queries structure and structure-building models using exact spatial bounds", async () => {
    await getStructuresFromToriiExact({} as never, [] as never, 10, 20, 30, 40);

    expect(getEntities).toHaveBeenCalledTimes(1);
    const [, query, , , models] = vi.mocked(getEntities).mock.calls[0];

    expect(models).toEqual(["s1_eternum-Structure", "s1_eternum-StructureBuildings"]);
    expect(JSON.stringify(query)).toContain("base.coord_x");
    expect(JSON.stringify(query)).toContain("base.coord_y");
    expect(JSON.stringify(query)).toContain("coord.x");
    expect(JSON.stringify(query)).toContain("coord.y");
    expect(JSON.stringify(query)).toContain("10");
    expect(JSON.stringify(query)).toContain("20");
    expect(JSON.stringify(query)).toContain("30");
    expect(JSON.stringify(query)).toContain("40");
  });
});
