import { Effect } from "effect";
import { describe, expect, test, vi } from "vitest";
import { createIdentityResolver } from "./auth";

const session = (address?: string | null) =>
  vi.fn(async () => Response.json({ session: { id: "session-1" }, user: { id: "u1", realmsId: "0x0007", address } }));

describe("verified session identity", () => {
  test("forwards the session cookie and trusts only the Realms account and wallet the identity Worker returns", async () => {
    const fetchSession = session("0x00123");
    const resolver = createIdentityResolver("https://play.realms.party", fetchSession);

    const identity = await Effect.runPromise(resolver.resolve("better-auth.session_token=signed"));

    expect(identity).toEqual({ realmsId: "0x7", wallet: "0x123" });
    expect(fetchSession).toHaveBeenCalledWith(new URL("https://play.realms.party/api/auth/get-session"), {
      headers: { accept: "application/json", cookie: "better-auth.session_token=signed" },
    });
  });

  test("keeps an account without a linked wallet as a player with no launcher identity", async () => {
    for (const address of [undefined, null]) {
      const resolver = createIdentityResolver("https://play.realms.party", session(address));
      expect(await Effect.runPromise(resolver.resolve("better-auth.session_token=signed"))).toEqual({
        realmsId: "0x7",
        wallet: null,
      });
    }
  });
});
