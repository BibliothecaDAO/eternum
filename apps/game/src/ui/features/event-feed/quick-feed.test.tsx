import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, expect, it, vi } from "vitest";
import { useConnectionStore } from "@/hooks/store/use-connection-store";
import { useHeadlineFeedStore } from "../news-headlines/headline-feed-store";
const mocks = vi.hoisted(() => ({
  nowMs: 1_000_000,
  stories: [] as any[],
  feed: { inFlight: [] as any[], arrived: [] as any[], recent: [] as any[] },
  navigate: vi.fn(),
  toast: { success: vi.fn(), warning: vi.fn(), dismiss: vi.fn() },
}));
vi.mock("@/hooks/helpers/use-block-timestamp", () => ({ useNowMs: () => mocks.nowMs }));
vi.mock("@/hooks/helpers/use-navigate", () => ({ useNavigateToMapView: () => mocks.navigate }));
vi.mock("@/hooks/store/use-account-store", () => ({ useAccountStore: () => "0x1" }));
vi.mock("@/hooks/store/use-story-events-store", () => ({ useStoryEvents: () => ({ data: mocks.stories }) }));
vi.mock("@/hooks/store/use-ui-store", () => ({ useUIStore: () => 900 }));
vi.mock("@/hooks/store/use-world-slices-store", () => ({ useWorldSlicesStore: () => undefined }));
vi.mock("@bibliothecadao/eternum", () => ({
  configManager: { getTick: () => 60 },
  Position: class {
    constructor(public value: { x: number; y: number }) {}
  },
}));
vi.mock("@bibliothecadao/react", () => ({ useDojo: () => ({ setup: { components: {} } }) }));
vi.mock("./use-feed-rows", () => ({ useFeedRows: () => mocks.feed }));
vi.mock("./story-feed-row", () => ({ resolveStoryEventPosition: () => null }));
vi.mock("./event-log-panel", () => ({ EventLogPanel: () => <div role="dialog">Log panel</div> }));
vi.mock("./notify", () => ({ toast: mocks.toast }));
import { QuickFeed } from "./quick-feed";

const battle = (id: string, at: number) =>
  ({
    id,
    timestampMs: at,
    story: "BattleStory",
    owner: "0x1",
    storyPayload: {},
    presentation: { title: "Battle", description: "Attacker [Ann] · Defender [Bob] · Winner: Ann" },
  }) as any;

const render = async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<QuickFeed />));
  return { container, unmount: () => act(async () => root.unmount()).then(() => container.remove()) };
};

beforeEach(() => {
  useHeadlineFeedStore.setState({ headlines: [] });
  mocks.stories = [];
  mocks.feed = { inFlight: [], arrived: [], recent: [] };
});

it("shows at most five fresh rows newest first with ticks, keeps pinned headlines on top and counts unread", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(mocks.nowMs - 30_000);
  const { container, unmount } = await render();
  try {
    expect(container.querySelectorAll('[aria-label="Quick feed"] button')).toHaveLength(1);
    mocks.stories = [1, 2, 3, 4, 5, 6].map((index) => battle(`b${index}`, mocks.nowMs - index * 1_000));
    mocks.stories.push(battle("stale", mocks.nowMs - 25_000));
    useHeadlineFeedStore.getState().publish({
      id: "pin",
      type: "t3-building",
      icon: "t3-building",
      title: "TIER 3",
      description: "Ann has raised a Tier 3 Barracks",
      timestamp: mocks.nowMs - 500,
    });
    mocks.nowMs += 1;
    await act(async () => useHeadlineFeedStore.setState({}));
    const feed = container.querySelector('[aria-label="Quick feed"]')!;
    expect(feed.firstElementChild?.getAttribute("aria-label")).toBe("Pinned event");
    expect(feed.firstElementChild?.textContent).toBe("Ann has raised a Tier 3 Barracks");
    const rows = [...feed.children].slice(1, -1);
    expect(rows).toHaveLength(5);
    expect(rows[0].textContent).toBe("Ann vs Bob · Ann winsT2");
    expect(container.querySelector('[aria-label="Unread events"]')?.textContent).toBe("7");
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Log"]')!.click());
    expect(container.querySelector('[role="dialog"]')?.textContent).toBe("Log panel");
    expect(container.querySelector('[aria-label="Unread events"]')).toBeNull();
  } finally {
    vi.useRealTimers();
    await unmount();
  }
});

it("turns connection changes into feed notices and pins a red offline row with retry", async () => {
  const { container, unmount } = await render();
  try {
    await act(async () => useConnectionStore.getState().setSpatialStatus("reconnecting"));
    expect(mocks.toast.warning).toHaveBeenCalledWith("Reconnecting…", { id: "connection" });
    await act(async () => useConnectionStore.getState().setSpatialStatus("failed"));
    expect(mocks.toast.dismiss).toHaveBeenCalledWith("connection");
    const offline = container.querySelector('[aria-label="Offline"]')!;
    expect(offline.textContent).toContain("Offline");
    expect(offline.querySelector("button")?.textContent).toBe("Retry");
    await act(async () => useConnectionStore.getState().setSpatialStatus("connected"));
    expect(mocks.toast.success).toHaveBeenCalledWith("Back online", { id: "connection" });
    expect(container.querySelector('[aria-label="Offline"]')).toBeNull();
  } finally {
    await unmount();
  }
});
