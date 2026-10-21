import { ActionRefusedError, createSystemCalls } from "@bibliothecadao/types";
import { afterEach, expect, it, vi } from "vitest";

import { useEventFeedStore } from "./event-feed-store";
import { toast } from "./notify";

const notices = () => useEventFeedStore.getState().notices.map(({ kind, title }) => ({ kind, title }));

afterEach(() => {
  useEventFeedStore.getState().dismiss();
  vi.restoreAllMocks();
});

it("tells a refused action's reason as news, and logs nothing: the game simply takes no action yet", () => {
  const logged = vi.spyOn(console, "error").mockImplementation(() => {});
  toast.failed(new ActionRefusedError("Starts in 2m 33s"), "Failed to create the hyperstructure.");
  expect(notices()).toEqual([{ kind: "info", title: "Starts in 2m 33s" }]);
  expect(logged).not.toHaveBeenCalled();
});

it("tells a failure from outside a system call as an error, and logs it once", () => {
  const logged = vi.spyOn(console, "error").mockImplementation(() => {});
  const failure = new Error("Insufficient wheat");
  toast.failed(failure, "Failed to create the hyperstructure.");
  expect(notices()).toEqual([{ kind: "error", title: "Insufficient wheat" }]);
  expect(logged.mock.calls).toEqual([["Failed to create the hyperstructure.", failure]]);
});

it("logs a system call's failure once: the system call's handler logs it, the notice beside it does not", async () => {
  const logged = vi.spyOn(console, "error").mockImplementation(() => {});
  const failure = new Error("Insufficient wheat");
  const calls = createSystemCalls({
    provider: { create_hyperstructure: async () => Promise.reject(failure) },
    // As bootstrap's handler does.
    authHandler: { onError: (error) => console.error(`System call error: ${error.message}`) },
  });
  await calls.create_hyperstructure({ signer: { address: "0x1" } } as never).catch((error: unknown) => {
    toast.failed(error, "Failed to create the hyperstructure.");
  });
  expect(notices()).toEqual([{ kind: "error", title: "Insufficient wheat" }]);
  expect(logged.mock.calls).toEqual([["System call error: Insufficient wheat"]]);
});

it("logs nothing for a system call refused before play, and tells its reason", async () => {
  const logged = vi.spyOn(console, "error").mockImplementation(() => {});
  const calls = createSystemCalls({
    provider: { create_hyperstructure: vi.fn() },
    authHandler: { refuseNow: () => "Starts in 2m 33s", onError: (error) => console.error(error) },
  });
  await calls.create_hyperstructure({ signer: { address: "0x1" } } as never).catch((error: unknown) => {
    toast.failed(error, "Failed to create the hyperstructure.");
  });
  expect(notices()).toEqual([{ kind: "info", title: "Starts in 2m 33s" }]);
  expect(logged).not.toHaveBeenCalled();
});
