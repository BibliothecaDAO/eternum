import { expect, it } from "vitest";
import type { NativeFactStore } from "../client/native-fact-store";
import type { NativeRows } from "../../../../contracts/l3/world-native/schema/client.gen";
import { armyCombatRefusal, isAspectAlly } from "./army-opponents";

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

it("calls an army an ally only when its home shares the Aspect of one of the viewer's realms", () => {
  const aspects = new Map<bigint, number>([
    [1n, 3],
    [2n, 3],
    [4n, 4],
  ]);
  const store = {
    get: (_model: string, key: { home: bigint | number }) => {
      const aspect = aspects.get(BigInt(key.home));
      return aspect === undefined ? undefined : { aspect };
    },
    *structuresOwnedBy() {
      yield { entity_id: 1n };
    },
  } as unknown as NativeFactStore;
  expect(isAspectAlly(store, 7, 9n, 2n)).toBe(true);
  expect(isAspectAlly(store, 7, 9n, 4n)).toBe(false);
  expect(isAspectAlly(store, 7, 9n, 5n)).toBe(false);
  expect(isAspectAlly(store, 7, null, 2n)).toBe(false);
});

it("takes the relation of whoever the viewer is now: a viewer of another Aspect sees the same army as no ally", () => {
  let viewer = 1n;
  const aspects = new Map<bigint, number>([
    [1n, 3],
    [2n, 3],
    [4n, 4],
  ]);
  const store = {
    get: (_model: string, key: { home: bigint | number }) => {
      const aspect = aspects.get(BigInt(key.home));
      return aspect === undefined ? undefined : { aspect };
    },
    *structuresOwnedBy() {
      yield { entity_id: viewer };
    },
  } as unknown as NativeFactStore;
  expect(isAspectAlly(store, 7, 9n, 2n)).toBe(true);
  viewer = 4n;
  expect(isAspectAlly(store, 7, 9n, 2n)).toBe(false);
});
