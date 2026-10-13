// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

// Identity's answer for an account, as it stood before the player claimed a name.
const answers = vi.hoisted(() => new Map<string, { name: string | null; portrait: string | null }>());
vi.mock("@realms-world/identity", async (original) => ({
  ...(await original<typeof import("@realms-world/identity")>()),
  fetchIdentityProfiles: async (_origin: string, accounts: string[]) =>
    Object.fromEntries(accounts.map((account) => [account, answers.get(account) ?? { name: null, portrait: null }])),
}));

import { useIdentitySessionStore } from "@/hooks/context/identity-session";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { identityProfiles, readPlayerProfile } from "./player-profiles";

const answered = () =>
  new Promise<void>((resolve) => {
    const stop = identityProfiles.subscribe(() => {
      stop();
      resolve();
    });
  });

afterEach(() => {
  useAccountStore.setState({ account: null } as never);
  useIdentitySessionStore.setState({ session: null } as never);
});

describe("a player's name", () => {
  it("is the signed-in player's own session's for their own account, so a name just claimed shows at once", async () => {
    useAccountStore.setState({ account: { address: "0x292" } } as never);
    useIdentitySessionStore.setState({ session: { user: { id: "0x292", name: "0x292", image: null } } } as never);
    const landed = answered();
    expect(readPlayerProfile("0x292").name).toBeNull();
    await landed;

    // The player claims a name: the session carries it; identity's cached answer for the account is still nameless.
    useIdentitySessionStore.setState({ session: { user: { id: "0x292", name: "uxplay", image: null } } } as never);
    expect(readPlayerProfile("0x292").name).toBe("uxplay");
  });

  it("is identity's answer for any other player", async () => {
    answers.set("0xa1", { name: "Maelis", portrait: null });
    const landed = answered();
    readPlayerProfile("0xa1");
    await landed;
    expect(readPlayerProfile("0xa1").name).toBe("Maelis");
  });
});
