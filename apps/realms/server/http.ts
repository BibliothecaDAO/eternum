import { Data, Effect } from "effect";

import type { IdentityAuth } from "./auth";

/** Identity answers are per caller, so none is cached. */
export const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "cache-control": "no-store" } });

/** A request refused with a fixed code, answered `{ error: code }` with its status. */
export class Refusal extends Data.TaggedError("Refusal")<{ readonly code: string; readonly status: number }> {}

/** Runs a route; each refusal becomes its JSON answer. */
export const respond = (route: Effect.Effect<Response, Refusal>): Promise<Response> =>
  Effect.runPromise(
    route.pipe(Effect.catchTag("Refusal", ({ code, status }) => Effect.succeed(json({ error: code }, status)))),
  );

/** The signed-in caller and their Realms id: refused 503 when sign-in cannot answer, 401 when no one is signed in. */
export const signedIn = (auth: IdentityAuth, request: Request) =>
  Effect.gen(function* () {
    const session = yield* Effect.tryPromise({
      try: () => auth.api.getSession({ headers: request.headers }),
      catch: () => new Refusal({ code: "authentication_unavailable", status: 503 }),
    });
    const realmsId = session?.user.realmsId;
    if (!session || !realmsId) return yield* new Refusal({ code: "unauthorized", status: 401 });
    return { session, realmsId };
  });

/** Whether the request says its body is JSON. */
export const isJsonRequest = (request: Request) =>
  request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() === "application/json";

/** The request's body as JSON, at most `limit` bytes; refused 400 with `code` when it is not that. */
export const readJsonBody = (request: Request, limit: number, code: string) =>
  Effect.tryPromise({
    try: async (): Promise<unknown> => JSON.parse(await readBody(request, limit)),
    catch: () => new Refusal({ code, status: 400 }),
  });

/** Reads at most `limit` bytes of UTF-8, so an oversized body is refused before it is buffered. */
async function readBody(request: Pick<Request, "body">, limit: number): Promise<string> {
  if (!request.body) throw new Error("missing_body");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new Error("body_too_large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(bytes);
}
