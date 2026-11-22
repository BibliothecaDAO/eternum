import { expect, it } from "vitest";
import { realmBoard } from "../build/build-fixture";
import { readRealmPopulation } from "./realm-population";

it("reads the realm's contract population from its buildings' row", () => {
  const { store } = realmBoard();
  expect(readRealmPopulation(store, 7)).toEqual({ used: 0, total: 12 });
  store.applyFacts([
    {
      model: "StructureBuildings",
      key: "0x72",
      value: {
        game_id: 1,
        entity_id: 7,
        packed_counts_1: "0",
        packed_counts_2: "0",
        packed_counts_3: "0",
        population: { current: 3, max: 6 },
      },
    },
  ] as never);
  expect(readRealmPopulation(store, 7)).toEqual({ used: 3, total: 12 });
});
