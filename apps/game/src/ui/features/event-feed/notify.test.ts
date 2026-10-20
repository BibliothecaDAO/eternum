import { ActionRefusedError } from "@bibliothecadao/types";
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

it("tells a failure's reason as an error and logs it once, for every caller", () => {
  const logged = vi.spyOn(console, "error").mockImplementation(() => {});
  const failure = new Error("Insufficient wheat");
  toast.failed(failure, "Failed to create the hyperstructure.");
  expect(notices()).toEqual([{ kind: "error", title: "Insufficient wheat" }]);
  expect(logged.mock.calls).toEqual([["Failed to create the hyperstructure.", failure]]);
});
