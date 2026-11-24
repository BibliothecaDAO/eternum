import { afterEach, beforeEach, expect, it, vi } from "vitest";

const client = vi.hoisted(() => ({ getSession: vi.fn(), signOut: vi.fn() }));
vi.mock("@realms-world/identity", () => ({ createIdentityClient: () => client }));
import { useAccountStore } from "@/hooks/store/use-account-store";
import { signOutIdentitySession, useIdentitySessionStore } from "./identity-session";

beforeEach(() => vi.resetAllMocks());

it("starts anonymous and unsettled so pages draw signed-out immediately", () => {
  expect(useIdentitySessionStore.getState()).toMatchObject({
    status: "anonymous",
    session: null,
    settled: false,
    error: null,
  });
});

it("sign-out clears the signer even without a mounted gameplay sync", async () => {
  useAccountStore.setState({ account: { address: "0xabc" } as never, owner: "0x1" });
  await signOutIdentitySession();
  expect(useIdentitySessionStore.getState()).toMatchObject({ status: "anonymous", settled: true });
  expect(useAccountStore.getState()).toMatchObject({ account: null, owner: null });
});

afterEach(() => {
  useIdentitySessionStore.getState().applySession(null);
  vi.useRealTimers();
});

it("keeps a failed initial read unsettled and retries without another subscriber", async () => {
  vi.useFakeTimers();
  useIdentitySessionStore.setState({ session: null, status: "anonymous", settled: false, error: null });
  const session = { user: { realmsId: "0x123" } };
  client.getSession.mockRejectedValueOnce(new Error("503")).mockResolvedValueOnce(session);
  await useIdentitySessionStore.getState().refresh();
  expect(useIdentitySessionStore.getState()).toMatchObject({ status: "anonymous", settled: false });
  expect(useIdentitySessionStore.getState().error).toBeInstanceOf(Error);
  await vi.advanceTimersByTimeAsync(5_000);
  expect(useIdentitySessionStore.getState()).toMatchObject({
    status: "signed-in",
    settled: true,
    session,
    error: null,
  });
});

it("exposes a TimeoutError immediately, backs off retries without clearing error, and recovers when the service answers", async () => {
  vi.useFakeTimers();
  useIdentitySessionStore.setState({ session: null, status: "anonymous", settled: false, error: null });
  const timeout = Object.assign(new Error("timed out"), {
    cause: new DOMException("The app's service did not answer in time", "TimeoutError"),
  });
  client.getSession.mockRejectedValueOnce(timeout).mockRejectedValueOnce(timeout).mockResolvedValueOnce(null);
  await useIdentitySessionStore.getState().refresh();
  expect(useIdentitySessionStore.getState()).toMatchObject({ status: "anonymous", settled: false, error: timeout });
  await vi.advanceTimersByTimeAsync(5_000);
  expect(client.getSession).toHaveBeenCalledTimes(2);
  expect(useIdentitySessionStore.getState()).toMatchObject({ status: "anonymous", settled: false, error: timeout });
  await vi.advanceTimersByTimeAsync(9_999);
  expect(client.getSession).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(1);
  expect(client.getSession).toHaveBeenCalledTimes(3);
  expect(useIdentitySessionStore.getState()).toMatchObject({
    status: "anonymous",
    settled: true,
    session: null,
    error: null,
  });
});

it("cancels pending backoff and clears error on an explicit refresh", async () => {
  vi.useFakeTimers();
  useIdentitySessionStore.setState({ session: null, status: "anonymous", settled: false, error: null });
  const session = { user: { realmsId: "0x456" } };
  let finish!: (value: unknown) => void;
  client.getSession.mockRejectedValueOnce(new Error("503")).mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  await useIdentitySessionStore.getState().refresh();
  expect(useIdentitySessionStore.getState().error).toBeInstanceOf(Error);
  const manual = useIdentitySessionStore.getState().refresh();
  expect(useIdentitySessionStore.getState().error).toBeNull();
  finish(session);
  await manual;
  expect(useIdentitySessionStore.getState()).toMatchObject({ status: "signed-in", session, error: null });
  await vi.advanceTimersByTimeAsync(30_000);
  expect(client.getSession).toHaveBeenCalledTimes(2);
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

it("coalesces concurrent refreshes into one read", async () => {
  let finish!: (session: unknown) => void;
  client.getSession.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const first = useIdentitySessionStore.getState().refresh();
  const second = useIdentitySessionStore.getState().refresh();
  expect(client.getSession).toHaveBeenCalledTimes(1);
  const session = { user: { realmsId: "0x22" } };
  finish(session);
  await Promise.all([first, second]);
  expect(useIdentitySessionStore.getState()).toMatchObject({ status: "signed-in", session });
});

it("queues a fresh read after an explicit session update while the old read is in flight", async () => {
  let finish!: (session: unknown) => void;
  const newSession = { user: { realmsId: "0x22" } };
  client.getSession
    .mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    )
    .mockResolvedValueOnce(newSession);
  const oldRead = useIdentitySessionStore.getState().refresh();
  useIdentitySessionStore.getState().applySession(null);
  const latestRead = useIdentitySessionStore.getState().refresh();
  const coalesced = useIdentitySessionStore.getState().refresh();
  expect(client.getSession).toHaveBeenCalledTimes(1);
  finish({ user: { realmsId: "0x11" } });
  await oldRead;
  await Promise.all([latestRead, coalesced]);
  expect(client.getSession).toHaveBeenCalledTimes(2);
  expect(useIdentitySessionStore.getState()).toMatchObject({ status: "signed-in", session: newSession });
});

it("keeps the known signed-in session during an outage and cancels its retry after sign-out", async () => {
  vi.useFakeTimers();
  const session = { user: { realmsId: "0x22" } };
  useIdentitySessionStore.getState().applySession(session as never);
  client.getSession.mockRejectedValue(new Error("offline"));
  await useIdentitySessionStore.getState().refresh();
  expect(useIdentitySessionStore.getState()).toMatchObject({ status: "signed-in", session });
  await signOutIdentitySession();
  await vi.advanceTimersByTimeAsync(10_000);
  expect(client.getSession).toHaveBeenCalledTimes(1);
  expect(useIdentitySessionStore.getState()).toMatchObject({ status: "anonymous", session: null });
});
