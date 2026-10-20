// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

// One reveal paying 57.6 Essence at contract precision, as the night's QA saw it: the army panel and the Log must write
// it alike. The contract's payout and the army's place stand in; the reading, the panel and the Log line are the real ones.
const PAYOUT = 57_600_000_000n;
vi.mock("@/hooks/context/game-context", () => ({ useGame: () => ({ setup: { store: {} } }) }));
vi.mock("./frontier-home", () => ({ useExpeditionRules: () => null }));
vi.mock("@bibliothecadao/eternum", async (original) => {
  const eternum = await original<typeof import("@bibliothecadao/eternum")>();
  return {
    ...eternum,
    configManager: {
      paysRevealSupplies: () => true,
      getActiveGameId: () => 1,
      getTroopConfig: () => ({ troop_limit_config: {} }),
    },
    entityMapPosition: () => ({ x: 0, y: 0 }),
    readRevealPercent: () => 25,
    revealYield: () => PAYOUT,
  };
});

const { buildStoryEventPresentation } = await import("@bibliothecadao/eternum");
const { ResourcesIds } = await import("@bibliothecadao/types");
const { useArmyRevealYield } = await import("./frontier-reveal-yield");
const { ArmyDetail } = await import("./army/army-panel");
const { readArmyDetail } = await import("./army/army-detail");
const { EARLY_ARMY } = await import("./research/progression-fixture");

const PanelOverTheReading = () => (
  <ArmyDetail
    army={readArmyDetail({
      ...EARLY_ARMY,
      revealYield: useArmyRevealYield({ explorerId: 7, troopsFact: {} } as never),
    })}
    sending={false}
    onLevelUp={() => undefined}
  />
);

it("writes a reveal's fractional reward the same in the army panel and in the Log", () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(<PanelOverTheReading />));
  const panel = /\+(\S+) a tile/.exec(host.textContent ?? "")?.[1];
  act(() => root.unmount());
  host.remove();

  const log = buildStoryEventPresentation({
    storyType: "ExplorationReward",
    storyPayload: { explorer_id: 7, receiver: 5, resource_type: ResourcesIds.Essence, amount: String(PAYOUT) },
    entityId: null,
    ownerAddress: "0x1",
    viewerAddress: null,
  } as never).title;

  expect(log).toBe("Explored: +58 Essence");
  expect(panel).toBe("58");
});

// Today's own line and the day's totals read the same reward (they rewrite the story themselves), and so do a cleared
// site's payout record and the season board's earned figure.
it("writes the same 57.6 reveal on Today's line, and keeps its fraction until the day's total is written", async () => {
  const { dayLogLine } = await import("./log/day-line");
  const { totalToday } = await import("./log/today-totals");
  const storyPayload = { explorer_id: 7, receiver: 5, resource_type: ResourcesIds.Essence, amount: String(PAYOUT) };
  const presentation = buildStoryEventPresentation({
    storyType: "ExplorationReward",
    storyPayload,
    entityId: null,
    ownerAddress: "0x1",
    viewerAddress: null,
  } as never);
  expect(dayLogLine({ story: "ExplorationReward", storyPayload, presentation } as never, {} as never)).toBe(
    "+58 Essence",
  );

  const fiveReveals = Array.from({ length: 5 }, () => ({
    story: "ExplorationReward",
    storyPayload: { resource_type: ResourcesIds.Essence, amount: String(PAYOUT) },
    owner: "0x1",
    timestampMs: 1_000,
  }));
  expect(totalToday(fiveReveals, "0x1", { startMs: 0, endMs: 2_000 }).essence).toBe(288);
});

it("reads a cleared site's 57.6 payout and the season's earned Essence exactly, for the one rounding", async () => {
  // The clear's own record, as the stream brought it for its transaction (fight-record read afresh with it).
  vi.resetModules();
  vi.doMock("@/hooks/store/use-story-events-store", () => ({
    streamedStoriesOf: () => [
      {
        story: "SitePayout",
        storyPayload: { reward: { resource_type: ResourcesIds.Essence, amount: String(PAYOUT) } },
      },
    ],
  }));
  const { readPayoutRecord } = await import("./sites/fight-record");
  const { earnedResource } = await import("./board/standings");
  expect(readPayoutRecord("0xabc")?.amount).toBe(57.6);
  expect(earnedResource(String(PAYOUT))).toBe(57.6);
});
