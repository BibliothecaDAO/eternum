import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEventFeedStore } from "./event-feed-store";
import { EventFeedTicker } from "./event-feed-ticker";
import { toast } from "./notify";

describe("EventFeedTicker", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    useEventFeedStore.setState({ notices: [] });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(<EventFeedTicker />));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.useRealTimers();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("shows a notice the moment it is raised and drops it after its ttl", async () => {
    expect(container.textContent).toBe("");

    await act(async () => {
      toast.success("Guild added to whitelist!", { duration: 1_000 });
    });
    expect(container.textContent).toContain("Guild added to whitelist!");

    await act(async () => {
      vi.advanceTimersByTime(1_100);
    });
    expect(container.textContent).toBe("");
    expect(useEventFeedStore.getState().notices).toHaveLength(1);
  });

  it("dismisses a notice by id", async () => {
    let id = "";
    await act(async () => {
      id = toast("Redirecting…");
    });
    expect(container.textContent).toContain("Redirecting…");
    await act(async () => {
      toast.dismiss(id);
    });
    expect(container.textContent).toBe("");
  });
});
