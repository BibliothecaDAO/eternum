import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ stories: [] as any[], feed: { recent: [] as any[], inFlight: [], arrived: [] } }));
vi.mock("@/hooks/store/use-account-store", () => ({ useAccountStore: () => "0x123" }));
vi.mock("@/hooks/store/use-story-events-store", () => ({ useStoryEvents: () => ({ data: state.stories }) }));
vi.mock("./use-feed-rows", () => ({ useFeedRows: () => state.feed }));
import { useUnreadEvents } from "./use-unread-events";
function Probe({ visible }: { visible: boolean }) {
  return <span>{useUnreadEvents(visible)}</span>;
}
it("badges new player battles and failures while hidden and clears when viewed", async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div"),
    root = createRoot(container);
  const render = async (visible: boolean) => act(async () => root.render(<Probe visible={visible} />));
  try {
    await render(true);
    await render(false);
    state.stories = [
      { id: "mine", timestampMs: Date.now(), owner: "0x123", storyPayload: {} },
      { id: "other", timestampMs: Date.now(), owner: "0x456", storyPayload: {} },
      { id: "old", timestampMs: 0, owner: "0x123", storyPayload: {} },
    ];
    state.feed.recent = [{ id: "failed", kind: "transaction", at: Date.now(), transaction: { status: "reverted" } }];
    await render(false);
    expect(container.textContent).toBe("2");
    await render(true);
    await render(false);
    expect(container.textContent).toBe("0");
  } finally {
    await act(async () => root.unmount());
  }
});
