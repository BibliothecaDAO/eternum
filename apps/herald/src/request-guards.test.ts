import { HERALD_GAME_FINALIZED_CLOSE } from "@bibliothecadao/eternum/game-sync";
import { describe, expect, it, vi } from "vitest";
import { acceptGameStream, answerSafely, createStreamSocketHandlers, type HeraldSocketData } from "./request-guards";
import { GameFinalizedError } from "./world-fold";

const socket = (data: HeraldSocketData) => ({ data, send: vi.fn(), close: vi.fn() });

describe("request guards", () => {
  it("validates and canonicalizes the whole actor/visit pair on connect and replacement", () => {
    const hasGame = { hasGame: () => true };
    expect(acceptGameStream("7", "0x00A", hasGame, "0x00B")).toEqual({ gameId: "7", actor: "0xa", visit: "0xb" });
    for (const visit of ["0x0", "bad", `0x${((1n << 251n) - 256n).toString(16)}`])
      expect((acceptGameStream("7", "0xa", hasGame, visit) as Response).status).toBe(400);
    const session = {} as never;
    const live = { attach: vi.fn(() => session), detach: vi.fn(), resume: vi.fn(), selectActor: vi.fn() };
    const handlers = createStreamSocketHandlers(live);
    const connection = socket({ gameId: "7", actor: "0xa", visit: "0xb" });
    handlers.open(connection);
    expect(live.attach).toHaveBeenCalledWith("7", connection, "0xa", "0xb");
    handlers.message(connection, JSON.stringify({ type: "select_actor", actor: "0x00A", visit: "0x00C" }));
    expect(live.selectActor).toHaveBeenLastCalledWith(session, "0xa", "0xc");
    for (const clearing of [{ visit: null }, {}]) {
      handlers.message(connection, JSON.stringify({ type: "select_actor", actor: "0xa", ...clearing }));
      expect(live.selectActor).toHaveBeenLastCalledWith(session, "0xa", undefined);
    }
    handlers.message(connection, JSON.stringify({ type: "select_actor", actor: "0xa", visit: "0x0" }));
    expect(connection.close).toHaveBeenCalledWith(1008, "Invalid gameplay account");
  });

  it("ends a stream attach to a finalized game by name instead of throwing out of the server", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const live = {
      attach: vi.fn(() => {
        throw new GameFinalizedError("7", ["TileOpt"]);
      }),
      detach: vi.fn(),
      resume: vi.fn(),
      selectActor: vi.fn(),
    };
    const handlers = createStreamSocketHandlers(live);
    const finalized = socket({ gameId: "7", actor: "0x1" });
    expect(() => handlers.open(finalized)).not.toThrow();
    expect(finalized.close).toHaveBeenCalledWith(HERALD_GAME_FINALIZED_CLOSE, "game_finalized");

    live.attach.mockImplementation(() => {
      throw new Error("anything else");
    });
    const failing = socket({ gameId: "8" });
    expect(() => handlers.open(failing)).not.toThrow();
    expect(failing.close).toHaveBeenCalledWith(1008, "anything else");

    live.detach.mockImplementation(() => {
      throw new Error("detach failed");
    });
    expect(() => handlers.close({ ...failing, data: { gameId: "8", session: {} as never } })).not.toThrow();
  });

  it("refuses a stream for a game the shard does not hold, before any socket or stream state exists", async () => {
    const live = { hasGame: vi.fn((gameId: string) => gameId === "7") };
    const refused = acceptGameStream("99999999", "0x1", live);
    expect(refused).toBeInstanceOf(Response);
    expect((refused as Response).status).toBe(404);
    expect(await (refused as Response).json()).toEqual({ error: "unknown_game", game_id: "99999999" });
    expect(acceptGameStream("7", "0x1", live)).toEqual({ gameId: "7", actor: "0x1" });
    expect(acceptGameStream("7", undefined, live)).toEqual({ gameId: "7" });
  });

  it("answers a failed request with a named status, whether it throws or rejects", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const request = new Request("http://herald/games/7/snapshot");
    const finalized = answerSafely(request, () => {
      throw new GameFinalizedError("7", ["TileOpt"]);
    }) as Response;
    expect(finalized.status).toBe(409);
    expect(await finalized.json()).toEqual({ error: "game_finalized", game_id: "7" });
    const rejected = await answerSafely(request, () => Promise.reject(new Error("boom")));
    expect(rejected?.status).toBe(500);
  });
});
