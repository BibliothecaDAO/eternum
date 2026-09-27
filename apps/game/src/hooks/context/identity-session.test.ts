import { beforeEach, expect, it, vi } from "vitest";

const client = vi.hoisted(() => ({ getSession: vi.fn(), signOut: vi.fn() }));
vi.mock("@realms-world/identity", () => ({ createIdentityClient: () => client }));
import { useAccountStore } from "@/hooks/store/use-account-store";
import { signOutIdentitySession, useIdentitySessionStore } from "./identity-session";

beforeEach(() => vi.clearAllMocks());

it("sign-out clears the signer even without a mounted gameplay sync", async () => {
  useAccountStore.setState({ account: { address: "0xabc" } as never, owner: "0x1" });
  await signOutIdentitySession();
  expect(useIdentitySessionStore.getState().status).toBe("anonymous");
  expect(useAccountStore.getState()).toMatchObject({ account: null, owner: null });
});
