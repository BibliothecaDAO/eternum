import { afterEach, beforeEach, expect, it, vi } from "vitest";

const client = vi.hoisted(() => ({ getSession: vi.fn(), signOut: vi.fn() }));
vi.mock("@realms-world/identity", () => ({ createIdentityClient: () => client }));
import { useAccountStore } from "@/hooks/store/use-account-store";
import { signOutIdentitySession, useIdentitySessionStore } from "./identity-session";

beforeEach(() => vi.resetAllMocks());

it("sign-out clears the signer even without a mounted gameplay sync", async () => {
  useAccountStore.setState({ account: { address: "0xabc" } as never, owner: "0x1" });
  await signOutIdentitySession();
  expect(useIdentitySessionStore.getState().status).toBe("anonymous");
  expect(useAccountStore.getState()).toMatchObject({ account: null, owner: null });
});

afterEach(() => {
  useIdentitySessionStore.getState().applySession(null);
  vi.useRealTimers();
});

it("keeps a failed initial read unknown and retries without another subscriber", async () => {
  vi.useFakeTimers();
  useIdentitySessionStore.setState({ session: null, status: "loading" });
  const session = { user: { realmsId: "0x123" } };
  client.getSession.mockRejectedValueOnce(new Error("503")).mockResolvedValueOnce(session);
  await useIdentitySessionStore.getState().refresh();
  expect(useIdentitySessionStore.getState().status).toBe("loading");
  await vi.advanceTimersByTimeAsync(5_000);
  expect(useIdentitySessionStore.getState()).toMatchObject({ status: "signed-in", session });
});

it("does not restore a session from a read that finishes after sign-out", async () => {
  let finish!: (session: unknown) => void;
  client.getSession.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const reading = useIdentitySessionStore.getState().refresh();
  await signOutIdentitySession();
  finish({ user: { realmsId: "0x123" } });
  await reading;
  expect(useIdentitySessionStore.getState()).toMatchObject({ status: "anonymous", session: null });
});
