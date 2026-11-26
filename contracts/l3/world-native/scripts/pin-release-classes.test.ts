import { expect, test } from "bun:test";
import { assertNoBuildPath, repinnedRelease } from "./pin-release-classes";

const release15 = { release: 15, logic: { combat: "0x4e", map: "0x1" } };
const changed = { release: 15, logic: { combat: "0x52", map: "0x1" } };
const unregistered = [
  { environment: "dev", releases: [13, 14] },
  { environment: "production", releases: [14] },
];

test("the same classes under the pinned release pass", () => {
  expect(repinnedRelease(release15, release15, false, [])).toEqual(release15);
});

test("a changed logic class under the pinned release is refused when only checked", () => {
  expect(() => repinnedRelease(changed, release15, false, unregistered)).toThrow(
    "Frontier logic classes combat differ from release 15's pin, and a shard refuses other classes under one release id: open release 16",
  );
});

test("a changed logic class repins its release while no environment's shard has registered it", () => {
  expect(repinnedRelease(changed, release15, true, unregistered)).toEqual(changed);
});

test("a changed logic class is refused once an environment's shard has registered its release, naming it", () => {
  const registered = [unregistered[0], { environment: "production", releases: [14, 15] }];
  expect(() => repinnedRelease(changed, release15, true, registered)).toThrow(
    "Frontier logic classes combat differ from release 15's pin, and production's shard registered release 15, so it refuses other classes under that id: open release 16",
  );
});

test("a changed logic class is refused while an environment's manifest cannot be read, naming it", () => {
  const unread = [{ environment: "dev", releases: null }, unregistered[1]];
  expect(() => repinnedRelease(changed, release15, true, unread)).toThrow(
    "Frontier logic classes combat differ from release 15's pin, and dev's Herald manifest could not be read to tell whether its shard registered it: open release 16",
  );
});

test("a new release is refused until repinned, and repinning writes its classes", () => {
  const release16 = { release: 16, logic: { combat: "0x52", map: "0x1" } };
  expect(() => repinnedRelease(release16, release15, false, [])).toThrow("Release 16 is not pinned");
  expect(repinnedRelease(release16, release15, true, unregistered)).toEqual(release16);
});

test("a release older than the pin is refused", () => {
  expect(() => repinnedRelease({ ...release15, release: 14 }, release15, true, unregistered)).toThrow(
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
