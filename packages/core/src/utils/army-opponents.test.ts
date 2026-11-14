import { expect, it } from "vitest";
import type { NativeFactStore } from "../client/native-fact-store";
import type { NativeRows } from "../../../../contracts/l3/world-native/schema/client.gen";
import { armyCombatRefusal } from "./army-opponents";

it("uses the native home Aspects and shared Deep boundary for army orders", () => {
  const army = { game_id: 7, explorer_id: 11n, owner: 1n } as NativeRows["ExplorerTroops"];
  const enemy = { ...army, explorer_id: 12n, owner: 2n };
  let aspect = 1;
  let row = 3584;
  let dayUnit = 14400;
  const store = {
    get: () => undefined,
    require: (model: string, key: { home?: bigint; explorer_id?: bigint }) => {
      if (model === "SliceRules") return { day_unit_seconds: dayUnit };
      if (model === "SettlementRules") return { spacing: 1024 };
      if (model === "ExplorerTroops") return key.explorer_id === army.explorer_id ? army : enemy;
      if (model === "HomeAspect") return { aspect: key.home === 1n ? 1 : aspect };
      throw new Error(`Unexpected fact ${model}`);
    },
    entityOccupancy: (_game: number, entity: bigint) => ({ col: 512, row: entity === 11n ? 3584 : row, alt: false }),
  } as unknown as NativeFactStore;
  expect(armyCombatRefusal(store, army, enemy)).toBe("allied");
  aspect = 2;
  expect(armyCombatRefusal(store, army, enemy)).toBeUndefined();
  row = 512;
  expect(armyCombatRefusal(store, army, enemy)).toBe("no-attack");
  dayUnit = 0;
  expect(armyCombatRefusal(store, army, enemy)).toBeUndefined();
  expect(armyCombatRefusal(store, army, { ...enemy, game_id: 8 })).toBe("no-attack");
});
