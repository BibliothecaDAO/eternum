import { expect, it } from "vitest";
import { expeditionSpireTile, readExpeditionRules } from "@bibliothecadao/eternum";
import { getHexDistance } from "@bibliothecadao/types";
import { clearedCampScenario } from "./cleared-camp-scenario";

it("stands the realm's second army on a cleared camp away from its spire, beside another cleared camp left empty", () => {
  const { store, startsAt } = clearedCampScenario();
  const spire = expeditionSpireTile(
    readExpeditionRules(store, 1)!,
    store.require("Structure", { game_id: 1, entity_id: 7 }),
    startsAt,
  )!;
  const army = store.entityOccupancy(1, 203)!;
  const [held, empty] = [711, 712].map((entityId) =>
    store.require("ExpeditionSite", { game_id: 1, entity_id: entityId }),
  );
  for (const camp of [held, empty]) {
    expect(camp.clear).not.toBeNull();
    expect(store.get("Structure", { game_id: 1, entity_id: Number(camp.entity_id) })).toBeUndefined();
  }
  expect({ col: army.col, row: army.row }).toEqual({ col: held.col, row: held.row });
  expect(getHexDistance(army, spire)).toBeGreaterThanOrEqual(2);
  expect([...store.rows("TileOccupancy")].some((tile) => tile.col === empty.col && tile.row === empty.row)).toBe(false);
});
