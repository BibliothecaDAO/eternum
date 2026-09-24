import { HERALD_GAME_FINALIZED_CLOSE } from "@bibliothecadao/eternum/game-sync";
import type { GameStreamSession } from "./game-stream";
import type { LiveWorld } from "./live-world";
import type { ResumeRequest } from "./stream-protocol";
import { GameFinalizedError } from "./world-fold";

// A failure while serving one request or stream ends that request or stream, by name. It never reaches the process:
// one stale subscriber must not take a shard's Herald down for everyone.

export interface HeraldSocketData {
  gameId: string;
  actor?: string;
  session?: GameStreamSession;
}

interface HeraldSocket {
  data: HeraldSocketData;
  send(data: string): unknown;
  close(code?: number, reason?: string): void;
}

type StreamWorld = Pick<LiveWorld, "attach" | "detach" | "resume" | "selectActor">;

/** The stream socket's entries, each guarded: open attaches, a message resumes or selects an actor, close detaches. */
export function createStreamSocketHandlers(live: StreamWorld) {
  return {
    open: (socket: HeraldSocket) =>
      guardStream(socket, "open", () => {
        socket.data.session = live.attach(socket.data.gameId, socket, socket.data.actor);
      }),
    message: (socket: HeraldSocket, message: string | Buffer) =>
      guardStream(socket, "message", () => {
        if (!socket.data.session) throw new Error("Stream session is not attached");
        const request = JSON.parse(String(message)) as { type?: string; actor?: string | null };
        if (request.type !== "select_actor") return live.resume(socket.data.session, parseResume(message));
        if (request.actor !== null && (typeof request.actor !== "string" || !/^0x[0-9a-f]{1,64}$/i.test(request.actor)))
          throw new Error("Invalid gameplay account");
        live.selectActor(socket.data.session, request.actor ?? undefined);
      }),
    close: (socket: HeraldSocket) =>
      guardStream(socket, "close", () => {
        if (socket.data.session) live.detach(socket.data.session);
      }),
  };
}

/** Answers an HTTP request; a failure becomes a named 409 for a finalized game, else a 500, and is logged. */
export function answerSafely(
  request: Request,
  run: () => Response | Promise<Response> | undefined,
): Response | Promise<Response> | undefined {
  const refuse = (error: unknown): Response => {
    logRefusal({ event: "herald_request_failed", route: new URL(request.url).pathname, error });
    return error instanceof GameFinalizedError
      ? Response.json({ error: "game_finalized", game_id: error.gameId }, { status: 409 })
      : Response.json({ error: "internal_error" }, { status: 500 });
  };
  try {
    const answer = run();
    return answer instanceof Promise ? answer.catch(refuse) : answer;
  } catch (error) {
    return refuse(error);
  }
}

const parseResume = (message: string | Buffer): ResumeRequest => {
  const request = JSON.parse(String(message)) as Partial<ResumeRequest>;
  const seq = request.seq;
  if (
    request.type !== "resume" ||
    typeof request.epoch !== "string" ||
    !Number.isSafeInteger(seq) ||
    seq === undefined ||
    seq < 0
  ) {
    throw new Error("Expected resume{epoch,seq}");
  }
  return request as ResumeRequest;
};

function guardStream(socket: HeraldSocket, step: "open" | "message" | "close", run: () => void): void {
  try {
    run();
  } catch (error) {
    logRefusal({ event: "herald_stream_refused", step, gameId: socket.data.gameId, actor: socket.data.actor, error });
    if (step === "close") return;
    if (error instanceof GameFinalizedError) socket.close(HERALD_GAME_FINALIZED_CLOSE, "game_finalized");
    // A close reason is limited to 123 bytes.
    else socket.close(1008, (error instanceof Error ? error.message : String(error)).slice(0, 120));
  }
}

function logRefusal({ error, ...context }: Record<string, unknown> & { error: unknown }): void {
  console.warn(JSON.stringify({ ...context, error: error instanceof Error ? error.message : String(error) }));
}
