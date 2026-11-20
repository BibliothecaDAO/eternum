import { expect, it, vi } from "vitest";
import { nativeIdentifiers } from "../../../../contracts/l3/world-native/schema/client.gen";
import { NATIVE_RELEASES } from "../../../../deploy/release/native-release";
import { releaseLine } from "../test-support/releases";
import { assertReleaseReadable } from "./game-release";
import { GameOnOlderNumbersError, ShardReleaseMismatchError } from "./shard";

vi.mock("../../../../deploy/release/native-release", async (original) => {
  const { NATIVE_RELEASES: lines } = await original<typeof import("../../../../deploy/release/native-release")>();
  return { NATIVE_RELEASES: { frontier: { ...lines.frontier, since: lines.frontier.release - 1 } } };
});

const FRONTIER = nativeIdentifiers.family.FRONTIER;
const BLITZ = nativeIdentifiers.family.BLITZ;
const RELEASE = NATIVE_RELEASES.frontier.release;

const readable =
  (release: number, created = release, catalogue = releaseLine("schema", [release])) =>
  () =>
    assertReleaseReadable(
      { game_id: 1, release_id: release, created_release_id: created },
      FRONTIER,
      catalogue,
      "schema",
      "http://shard.test",
    );

it("every family's first release on this build's numbers is never past the build's own release", async () => {
  const actual = await vi.importActual<typeof import("../../../../deploy/release/native-release")>(
    "../../../../deploy/release/native-release",
  );
  for (const line of Object.values(actual.NATIVE_RELEASES)) {
    expect(line.since).toBeGreaterThanOrEqual(1);
    expect(line.since).toBeLessThanOrEqual(line.release);
  }
});

it("reads a game pinned to any release that runs the balance numbers this client carries", () => {
  expect(readable(RELEASE - 1)).not.toThrow();
  expect(readable(RELEASE)).not.toThrow();
});

it("refuses a game still pinned to a release whose numbers a tune has since changed", () => {
  expect(readable(RELEASE - 2)).toThrow(GameOnOlderNumbersError);
  expect(readable(RELEASE - 2)).toThrow(`release ${RELEASE - 2} runs older balance numbers`);
});

it("refuses a game pinned past the release this client was built for, so a cached client reloads", () => {
  expect(readable(RELEASE + 1)).toThrow(`release ${RELEASE + 1} has no decoder`);
  expect(readable(RELEASE + 1)).toThrow(ShardReleaseMismatchError);
});

it("walks a game's family line by its previous releases, past another family's release between them", () => {
  const catalogue = {
    [RELEASE - 2]: { schema: "schema", family: FRONTIER, previous: 0 },
    [RELEASE - 1]: { schema: "another", family: BLITZ, previous: 0 },
    [RELEASE]: { schema: "schema", family: FRONTIER, previous: RELEASE - 2 },
  };
  expect(readable(RELEASE, RELEASE - 2, catalogue)).not.toThrow();
  const linkedToBlitz = { ...catalogue, [RELEASE]: { ...catalogue[RELEASE], previous: RELEASE - 1 } };
  expect(readable(RELEASE, RELEASE - 2, linkedToBlitz)).toThrow(`release ${RELEASE - 1} has no decoder`);
});

it("refuses a release the catalogue names in another family than the game's", () => {
  expect(readable(RELEASE, RELEASE, releaseLine("schema", [RELEASE], BLITZ))).toThrow(
    `release ${RELEASE} has no decoder`,
  );
});

it("refuses a game of a family this build reads no release line for", () => {
  const game = { game_id: 1, release_id: RELEASE, created_release_id: RELEASE };
  expect(() =>
    assertReleaseReadable(game, BLITZ, releaseLine("schema", [RELEASE], BLITZ), "schema", "http://shard.test"),
  ).toThrow(`release family ${BLITZ} has no decoder`);
});
