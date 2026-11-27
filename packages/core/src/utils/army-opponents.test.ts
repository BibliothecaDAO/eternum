import { expect, it } from "vitest";
import type { NativeFactStore } from "../client/native-fact-store";
import type { NativeRows } from "../../../../contracts/l3/world-native/schema/client.gen";
import { nativeCommandBits } from "../../../../contracts/l3/world-native/schema/commands.gen";
import { armyCombatRefusal, isAspectAlly, sharesAspect } from "./army-opponents";

it("refuses army targets when Battle is disabled, games differ, or homes share an Aspect", () => {
  const army = { game_id: 7, explorer_id: 11n, owner: 1n } as NativeRows["ExplorerTroops"];
  const enemy = { ...army, explorer_id: 12n, owner: 2n };
  const ally = { ...army, explorer_id: 13n, owner: 3n };
  const missingAspect = { ...army, explorer_id: 14n, owner: 4n };
  const explorers = new Map<bigint, NativeRows["ExplorerTroops"]>([
    [11n, army],
    [12n, enemy],
    [13n, ally],
    [14n, missingAspect],
  ]);
  const aspects = new Map<bigint, number>([
    [1n, 1],
    [2n, 2],
    [3n, 1],
  ]);
  let commandMask = 0n;
  let deepRules: Record<string, unknown> | undefined;
  const store = {
    get: (model: string, key: { explorer_id?: bigint | number; home?: bigint | number }) => {
      if (model === "DeepRules") return deepRules;
      if (model === "ExplorerTroops") return explorers.get(BigInt(key.explorer_id!));
      if (model === "HomeAspect") {
        const aspect = aspects.get(BigInt(key.home!));
        return aspect === undefined ? undefined : { aspect };
      }
      return undefined;
    },
    require: (model: string, key: { home?: bigint | number }) => {
      if (model === "SliceRules") return { command_mask: commandMask };
      if (model === "HomeAspect") {
        const aspect = aspects.get(BigInt(key.home!));
        if (aspect === undefined) throw new Error(`Missing HomeAspect ${key.home}`);
        return { aspect };
      }
      throw new Error(`Unexpected fact ${model}`);
    },
  } as unknown as NativeFactStore;
  expect(armyCombatRefusal(store, army, enemy)).toBe("no-attack");
  commandMask = BigInt(nativeCommandBits.Battle);
  expect(armyCombatRefusal(store, army, enemy)).toBeUndefined();
  expect(armyCombatRefusal(store, army, ally)).toBe("allied");
  expect(armyCombatRefusal(store, army, { ...enemy, game_id: 8 })).toBe("no-attack");
  expect(sharesAspect(store, 7, 4n, 0)).toBe(false);
  expect(() => sharesAspect(store, 7, 4n, 1)).toThrow("Missing HomeAspect 4");
  deepRules = {};
  expect(() => armyCombatRefusal(store, army, missingAspect)).toThrow("Missing HomeAspect 4");
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
