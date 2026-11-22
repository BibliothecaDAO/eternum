import { beforeEach, expect, it, vi } from "vitest";
import { forEachGame, runShardJobs } from "./shard-jobs";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

it("reports a job that throws under its own label and still runs the next job, keeping every failure", async () => {
  const ran: string[] = [];
  const failures = await runShardJobs(
    {
      "settle ended games": async () => {
        ran.push("settle ended games");
        throw new Error("HTTP 429 Too Many Requests");
      },
      "pay race rewards": async () => {
        ran.push("pay race rewards");
        return [
          { game: 7, error: new Error("herald_unavailable") },
          { game: 9, error: new Error("snapshot_row_missing") },
        ];
      },
    },
    [],
  );
  expect(ran).toEqual(["settle ended games", "pay race rewards"]);
  expect(failures).toEqual([
    { job: "settle ended games", game: null, code: "settle ended games", cause: "HTTP 429 Too Many Requests" },
    { job: "pay race rewards", game: 7, code: "pay race rewards", cause: "herald_unavailable" },
    { job: "pay race rewards", game: 9, code: "pay race rewards", cause: "snapshot_row_missing" },
  ]);
});

it("runs every game after one fails and reports each failed game by its id", async () => {
  const ran: number[] = [];
  const failures = await runShardJobs(
    {
      "settle ended games": () =>
        forEachGame([{ game_id: 3 }, { game_id: 4 }, { game_id: 5 }], async (game) => {
          ran.push(game.game_id);
          if (game.game_id !== 4) throw new Error(`shard refused game ${game.game_id}`);
        }),
    },
    [],
  );
  expect(ran).toEqual([3, 4, 5]);
  expect(failures).toEqual([
    { job: "settle ended games", game: 3, code: "settle ended games", cause: "shard refused game 3" },
    { job: "settle ended games", game: 5, code: "settle ended games", cause: "shard refused game 5" },
  ]);
});

it("redacts a configured secret from the reported cause", async () => {
  const failures = await runShardJobs(
    {
      "pay race rewards": async () => {
        throw new Error("co-signer refused relay-operator-secret for game 7");
      },
    },
    ["relay-operator-secret"],
  );
  expect(failures).toEqual([
    { job: "pay race rewards", game: null, code: "pay race rewards", cause: "co-signer refused [redacted] for game 7" },
  ]);
});

it("reports a declared relay error as the failure's code", async () => {
  const failures = await runShardJobs(
    { "pay race rewards": async () => [{ game: 7, error: new Error("race_unfunded") }] },
    [],
  );
  expect(failures).toEqual([{ job: "pay race rewards", game: 7, code: "race_unfunded", cause: "race_unfunded" }]);
});

it("reports nothing when every job succeeds for every game", async () => {
  expect(
    await runShardJobs(
      { "settle ended games": () => forEachGame([{ game_id: 3 }], async () => {}), "pay race rewards": async () => [] },
      [],
    ),
  ).toEqual([]);
});
