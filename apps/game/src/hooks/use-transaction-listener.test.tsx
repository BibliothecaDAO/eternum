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
});

const fail = (payload: Record<string, unknown>) =>
  act(async () => {
    provider.emitter!.emit("transactionFailed", { type: TransactionType.TRAVEL_HEX, ...payload });
  });

it("says on screen why the game refused an action, whichever handler sent it", async () => {
  await fail({
    transactionHash: "0x476f",
    stage: "revert",
    message: "movement tile occupied",
    error: new Error("movement tile occupied"),
  });
  expect(shownNotices()).toEqual(["movement tile occupied"]);
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
