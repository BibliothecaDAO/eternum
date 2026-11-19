import { expect, it, vi } from "vitest";
import { NATIVE_RELEASE_ID } from "../../../../deploy/release/native-release";
import { assertReleaseReadable } from "./game-release";
import { GameOnOlderNumbersError, ShardReleaseMismatchError } from "./shard";

vi.mock("../../../../deploy/release/native-release", async (original) => {
  const release = await original<typeof import("../../../../deploy/release/native-release")>();
  return { ...release, NATIVE_BALANCE_SINCE_RELEASE: release.NATIVE_RELEASE_ID - 1 };
});

const readable = (release: number) => () =>
  assertReleaseReadable(
    { game_id: 1, release_id: release, created_release_id: release, preset_commitment: "0x789" },
    { [release]: "schema" },
    "schema",
    "http://shard.test",
  );

it("the first release on this build's numbers is never past the build's own release", async () => {
  const actual = await vi.importActual<typeof import("../../../../deploy/release/native-release")>(
    "../../../../deploy/release/native-release",
  );
  expect(actual.NATIVE_BALANCE_SINCE_RELEASE).toBeGreaterThanOrEqual(1);
  expect(actual.NATIVE_BALANCE_SINCE_RELEASE).toBeLessThanOrEqual(actual.NATIVE_RELEASE_ID);
});

it("reads a game pinned to any release that runs the balance numbers this client carries", () => {
  expect(readable(NATIVE_RELEASE_ID - 1)).not.toThrow();
  expect(readable(NATIVE_RELEASE_ID)).not.toThrow();
});

it("refuses a game still pinned to a release whose numbers a tune has since changed", () => {
  expect(readable(NATIVE_RELEASE_ID - 2)).toThrow(GameOnOlderNumbersError);
  expect(readable(NATIVE_RELEASE_ID - 2)).toThrow(`release ${NATIVE_RELEASE_ID - 2} runs older balance numbers`);
});

it("refuses a game pinned past the release this client was built for, so a cached client reloads", () => {
  expect(readable(NATIVE_RELEASE_ID + 1)).toThrow(`release ${NATIVE_RELEASE_ID + 1} has no decoder`);
  expect(readable(NATIVE_RELEASE_ID + 1)).toThrow(ShardReleaseMismatchError);
});
