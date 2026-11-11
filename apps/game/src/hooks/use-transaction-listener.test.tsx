// @vitest-environment jsdom
import { EventEmitter } from "node:events";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

// The game's provider, as the listener hears it: the events a send emits.
const provider = vi.hoisted(() => ({ emitter: null as EventEmitter | null }));
vi.mock("@/hooks/context/game-context", () => ({
  useGame: () => ({ setup: { network: { provider: provider.emitter } } }),
}));
/** The app the client runs in; the web unless a test says otherwise. */
const app = vi.hoisted(() => ({ channel: "web" as "web" | "play" | "app-store" }));
vi.mock("@/runtime/distribution-channel", () => ({ distributionChannel: () => app.channel }));
vi.mock("@/observability/transaction-failure-reporting", () => ({
  addClientTransactionBreadcrumb: () => {},
  reportClientTransactionFailure: async () => {},
}));

const { TransactionType } = await import("@bibliothecadao/provider");
const { useEventFeedStore } = await import("@/ui/features/event-feed/event-feed-store");
const { useTransactionStore } = await import("@/hooks/store/use-transaction-store");
const { useTransactionListener } = await import("./use-transaction-listener");

/** The notices the Events strip shows above the stories, by their words. */
const shownNotices = () => useEventFeedStore.getState().notices.map((notice) => notice.title);

const Listener = () => {
  useTransactionListener();
  return null;
};

let host: HTMLDivElement;
let root: Root;
beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  provider.emitter = new EventEmitter();
  useEventFeedStore.setState({ notices: [] });
  useTransactionStore.setState({ transactions: [] });
  host = document.createElement("div");
  root = createRoot(host);
  await act(async () => root.render(<Listener />));
});
afterEach(async () => {
  await act(async () => root.unmount());
  delete (window as { Capacitor?: unknown }).Capacitor;
  app.channel = "web";
});

const fail = (payload: Record<string, unknown>) =>
  act(async () => {
    provider.emitter!.emit("transactionFailed", { type: TransactionType.TRAVEL_HEX, ...payload });
  });

it.each(["movement tile occupied", "stale release"])(
  "shows the refusal %s on screen, whichever handler sent it",
  async (reason) => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    await fail({
      transactionHash: "0x476f",
      stage: "revert",
      message: reason,
      error: new Error(reason),
    });
    expect(shownNotices()).toEqual([reason]);
    expect(logged).not.toHaveBeenCalled();
    logged.mockRestore();
  },
);

it("says on screen an action the shard refused before sending it, in the refusal's words", async () => {
  const refusal = new Error("Another action from this account was sent first, perhaps from another tab. Try again.");
  await fail({
    stage: "submit",
    failureKind: "not_sent",
    transactionHash: "0x4771",
    message: refusal.message,
    error: refusal,
  });
  expect(shownNotices()).toEqual([refusal.message]);
});

it("says nothing of an action whose outcome is still being checked, which may yet apply", async () => {
  await fail({
    transactionHash: "0x4770",
    stage: "background_confirmation",
    message: "Request timed out",
    error: new Error("Request timed out"),
  });
  expect(shownNotices()).toEqual([]);
});

/** The iOS app's bridge, recording each plugin call; injected on every channel, as only the channel may decide. */
const installAppBridge = () => {
  const calls: string[] = [];
  (window as { Capacitor?: unknown }).Capacitor = {
    isNativePlatform: () => true,
    nativePromise: async (plugin: string, method: string, options?: { style?: string }) => {
      calls.push(`${plugin}.${method}:${options?.style}`);
    },
    addListener: () => ({ remove: async () => {} }),
  };
  return calls;
};

const confirm = (hash: string) =>
  act(async () => {
    provider.emitter!.emit("transactionComplete", {
      type: TransactionType.TRAVEL_HEX,
      details: { transaction_hash: hash },
      admissionToVisibleMs: 120,
    });
  });

it.each([
  ["app-store", ["Haptics.impact:LIGHT"]],
  ["web", []],
  ["play", []],
] as const)("on the %s channel, a confirmed action taps %j", async (channel, taps) => {
  app.channel = channel;
  const calls = installAppBridge();
  await confirm("0x4780");
  expect(calls).toEqual(taps);
});

it("taps nothing in the iOS app for an action the game refused", async () => {
  app.channel = "app-store";
  const calls = installAppBridge();
  await fail({ transactionHash: "0x4781", stage: "revert", message: "movement tile occupied" });
  expect(calls).toEqual([]);
});
