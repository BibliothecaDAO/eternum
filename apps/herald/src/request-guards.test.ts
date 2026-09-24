import { HERALD_GAME_FINALIZED_CLOSE } from "@bibliothecadao/eternum/game-sync";
import { describe, expect, it, vi } from "vitest";
import { answerSafely, createStreamSocketHandlers, type HeraldSocketData } from "./request-guards";
import { GameFinalizedError } from "./world-fold";

const socket = (data: HeraldSocketData) => ({ data, send: vi.fn(), close: vi.fn() });

describe("request guards", () => {
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
