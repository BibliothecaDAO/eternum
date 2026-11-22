import { expect, test } from "bun:test";
import { assertNoBuildPath, repinnedRelease } from "./pin-release-classes";

const release15 = { release: 15, logic: { combat: "0x4e", map: "0x1" } };

test("the same classes under the pinned release pass", () => {
  expect(repinnedRelease(release15, release15, false)).toEqual(release15);
});

test("a changed logic class under the pinned release is refused, written or not", () => {
  const changed = { release: 15, logic: { combat: "0x52", map: "0x1" } };
  for (const write of [false, true])
    expect(() => repinnedRelease(changed, release15, write)).toThrow(
      "Frontier logic classes combat differ from release 15's pin, and a shard refuses other classes under one release id: open release 16",
    );
});

test("a new release is refused until repinned, and repinning writes its classes", () => {
  const release16 = { release: 16, logic: { combat: "0x52", map: "0x1" } };
  expect(() => repinnedRelease(release16, release15, false)).toThrow("Release 16 is not pinned");
  expect(repinnedRelease(release16, release15, true)).toEqual(release16);
});

test("a release older than the pin is refused", () => {
  expect(() => repinnedRelease({ ...release15, release: 14 }, release15, true)).toThrow(
    "Release 14 is older than the pinned release 15",
  );
});

test("a class naming a closure by the checkout's path is refused, with the file and lines it names", () => {
  const combat = `{"type_names":[[570,"{closure@/work/2/contracts/l3/world-native/src/logic/deep_guards.cairo:132:13: 134:14}"]]}`;
  expect(() => assertNoBuildPath({ "CombatLogic.json": combat, "MapLogic.json": "{}" }, "/work/2/")).toThrow(
    "write it as a match or a named function: CombatLogic.json: {closure@contracts/l3/world-native/src/logic/deep_guards.cairo:132:13: 134:14}",
  );
  expect(() => assertNoBuildPath({ "CombatLogic.json": combat }, "/elsewhere/")).not.toThrow();
});
