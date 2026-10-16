import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

const PLAYER = "0x1";

/** The game's history as each story read serves it: by story, and by every player a story names. */
const history = vi.hoisted(() => [] as { id: string; story: string; owner: string; participants: string[] }[]);

vi.mock("@/hooks/helpers/use-block-timestamp", () => ({ useNowMs: () => 200_000 }));
vi.mock("@/hooks/store/use-account-store", () => ({
  useAccountStore: (select: (state: unknown) => unknown) => select({ account: { address: PLAYER } }),
}));
vi.mock("@/hooks/store/use-story-events-store", () => ({
  useStoryEvents: (limit: number, story?: string, owner?: string) => ({
    data: history
      .filter((event) => !story || event.story === story)
      .filter((event) => !owner || event.participants.some((address) => BigInt(address) === BigInt(owner)))
      .slice(0, limit)
      .map((event) => ({
        ...event,
        event_id: event.id,
        tx_hash: `0x${event.id}`,
        timestamp: "100",
        timestampMs: 100_000,
        storyPayload: {},
      })),
  }),
}));
vi.mock("./use-feed-rows", () => ({ useFeedRows: () => ({ inFlight: [], arrived: [], recent: [] }) }));
vi.mock("@bibliothecadao/eternum", () => ({ configManager: { getTick: () => 60 } }));

import { useImportantFeed } from "./quick-feed";

const Rows = () => (
  <>
    {useImportantFeed()
      .rows.map((row) => row.id)
      .join(",")}
  </>
);

it("brings the player's opened crate into Events among every battle, without the routine stories", () => {
  history.push(
    { id: "battle", story: "BattleEvent", owner: "0x5", participants: ["0x5", "0x6"] },
    { id: "crate", story: "RelicChestOpened", owner: PLAYER, participants: [PLAYER] },
    { id: "made", story: "ProductionStory", owner: PLAYER, participants: [PLAYER] },
    { id: "theirs", story: "RelicChestOpened", owner: "0x2", participants: ["0x2"] },
  );
  expect(
    renderToStaticMarkup(<Rows />)
      .split(",")
      .toSorted(),
  ).toEqual(["story:battle", "story:crate"]);
});
