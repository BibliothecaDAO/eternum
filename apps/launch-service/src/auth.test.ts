import { Effect } from "effect";
import { describe, expect, test, vi } from "vitest";
import { createIdentityResolver } from "./auth";

describe("verified launcher identity", () => {
  test("forwards the session cookie and trusts only the identity response address", async () => {
    const fetchSession = vi.fn(async () =>
      Response.json({
        session: { id: "session-1" },
        user: { id: "0x00123" },
      }),
    );
    const resolver = createIdentityResolver("http://127.0.0.1:3000", fetchSession as unknown as typeof fetch);

    const identity = await Effect.runPromise(resolver.resolve("better-auth.session_token=signed"));

    expect(identity).toEqual({ address: "0x123" });
    expect(fetchSession).toHaveBeenCalledWith(new URL("http://127.0.0.1:3000/api/auth/get-session"), {
      headers: { accept: "application/json", cookie: "better-auth.session_token=signed" },
    });
  });
});
