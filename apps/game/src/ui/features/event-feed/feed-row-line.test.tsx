import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProcessedStoryEvent } from "@/hooks/store/use-story-events-store";

/** The game as a row reads it: the armies that stand and the view the player is in. */
const game = vi.hoisted(() => ({
  armies: new Set<number>(),
  navigate: vi.fn(),
}));

vi.mock("@/hooks/context/game-context", () => ({
  useGame: () => ({
    setup: {
      store: {
        // Every army here calls realm 5 home.
        get: (model: string, key: { explorer_id?: number; entity_id?: number }) =>
          model === "ExplorerTroops" && game.armies.has(Number(key.explorer_id))
            ? { explorer_id: key.explorer_id, owner: 5n }
            : model === "Structure" && Number(key.entity_id) === 5
              ? { entity_id: 5n }
              : undefined,
      },
    },
  }),
}));
vi.mock("@/hooks/helpers/use-native-facts", () => ({ useNativeRevision: () => 0, useNativeRow: () => undefined }));
vi.mock("@/play/navigation/open-place", async (original) => ({
  ...(await original<typeof import("@/play/navigation/open-place")>()),
  openOnMap: game.navigate,
}));
vi.mock("@bibliothecadao/eternum", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@bibliothecadao/eternum")>()),
  configManager: {
    getActiveGameId: () => 1,
  },
  entityMapPosition: () => ({ x: 50, y: 60 }),
  structureMapPosition: (_store: unknown, structure: { entity_id: bigint }) =>
    structure.entity_id === 5n ? { x: 70, y: 80 } : null,
}));

import { FeedRowLine } from "./feed-row-line";
import { eventsReads, selectEventStories } from "./event-stories";
import { StoryFeedRow } from "./story-feed-row";
import { Tooltip } from "@/ui/design-system/molecules/tooltip";
import { useTooltipStore } from "@/hooks/store/use-tooltip-store";
import { buildStoryEventPresentation } from "@bibliothecadao/eternum";

const PLAYER = "0x1";
const story = (id: string, kind: string, owner: string, payload: Record<string, unknown>, title: string) =>
  ({
    id,
    event_id: id,
    story: kind,
    owner,
    participants: [owner],
    tx_hash: `0x${id}`,
    // Its subject: the structure a capture took, here one for every story.
    entity_id: 5,
    timestamp: "100",
    timestampMs: 100_000,
    storyPayload: payload,
    presentation: { title, description: title },
  }) as unknown as ProcessedStoryEvent;
let host: HTMLDivElement;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement("div");
  game.armies = new Set([9]);
  game.navigate.mockClear();
});
afterEach(() => host.remove());

/** The Events stories among these, as the card selects them under Important, its first lens. */
const eventsRows = (stories: ProcessedStoryEvent[]) => selectEventStories(stories, "important", PLAYER);

describe("A capture in Events", () => {
  it("tells the player who lost a structure who took it from them, and what went with it, under Mine", async () => {
    const { buildStoryEventPresentation } = await import("@bibliothecadao/eternum");
    const payload = { previous_owner: PLAYER, new_owner: "0xc1", points: 0 };
    const presentation = buildStoryEventPresentation(
      {
        storyType: "StructureCapturedStory",
        storyPayload: payload,
        ownerAddress: "0xc1",
        viewerAddress: PLAYER,
      } as never,
      undefined,
      (address) => (BigInt(address) === 0xc1n ? "clientlane" : null),
    );
    const taken = {
      ...story("taken", "StructureCapturedStory", "0xc1", payload, presentation.title),
      participants: ["0xc1", PLAYER],
      presentation,
    } as ProcessedStoryEvent;
    const [event] = selectEventStories([taken], "important", PLAYER);
    expect(renderToStaticMarkup(<FeedRowLine event={event} />)).toContain(
      "clientlane took a structure from you. Its armies and deliveries went with it",
    );
  });
});

describe("A fight in Events", () => {
  /** A fight against the Vanguard, worded by the game's own story formatter, as the player's Events row. */
  const fightRow = async (attackerAfter: string, defenderAfter: string, winner: number) => {
    const { buildStoryEventPresentation } = await import("@bibliothecadao/eternum");
    const payload = {
      attacker_id: 20,
      defender_id: 21,
      attacker_owner: 10,
      defender_owner: 0,
      winner_id: winner,
      attacker: { player: PLAYER, category: "Knight", tier: "T1", before: "10", after: attackerAfter, roll: 0 },
      defender: { player: "0x0", category: "Knight", tier: "T1", before: "10", after: defenderAfter, roll: 0 },
    };
    const presentation = buildStoryEventPresentation(
      { storyType: "BattleEvent", storyPayload: payload, entityId: 20, ownerAddress: PLAYER } as never,
      undefined,
      (address) => (BigInt(address) === BigInt(PLAYER) ? "clientlane" : null),
    );
    const battle = { ...story("fight", "BattleEvent", PLAYER, payload, presentation.title), presentation };
    return renderToStaticMarkup(<FeedRowLine event={eventsRows([battle])[0]} />);
  };

  it("names a fight both sides survive a draw, which no one wins", async () => {
    const html = await fightRow("5", "4", 0);
    expect(html).toContain("clientlane vs The Vanguard · Draw");
    expect(html).not.toContain("wins");
  });

  it("names the winner of a decided fight", async () => {
    expect(await fightRow("5", "0", 10)).toContain("clientlane vs The Vanguard · clientlane wins");
  });
});

it("draws each story in Events and the Log by its act, as Frontier's Feed does, not a castle for all", () => {
  const fight = story(
    "fight",
    "BattleEvent",
    PLAYER,
    { attacker_id: 9, defender_id: 4_242 },
    "clientlane vs Emberdeep · Army lost",
  );
  const found = story("found", "ExplorationReward", PLAYER, { explorer_id: 9, coord: { x: 3, y: 4 } }, "Explored");
  const icons = (markup: string) => [...markup.matchAll(/data-icon="([^"]+)"/g)].map(([, icon]) => icon);
  for (const Row of [FeedRowLine, StoryFeedRow]) {
    expect(icons(renderToStaticMarkup(<Row event={fight} />))).toEqual(["attack"]);
    expect(icons(renderToStaticMarkup(<Row event={found} />))).toEqual(["explore"]);
  }
});

it.each([
  [{ Shrine: 200 }, "Shrine used, +200 XP", []],
  [{ ShrinePoint: 3 }, "Shrine used, III +1", ["III"]],
  [{ Well: 5 }, "Well used, +5 stamina", []],
])(
  "the Log renders site use and opens its historical tile after the army is gone (%j)",
  async (benefit, expected, gems) => {
    game.armies.clear();
    const event = story("site-use", "SiteUsed", PLAYER, { explorer_id: 9, coord: { x: 3, y: 4 }, benefit }, expected);
    event.presentation = buildStoryEventPresentation({
      storyType: event.story,
      storyPayload: event.storyPayload,
      entityId: 9,
      ownerAddress: PLAYER,
      viewerAddress: PLAYER,
    } as never);
    expect(eventsReads("all", PLAYER)).toEqual([{ limit: 350 }]);
    expect(selectEventStories([event], "all", PLAYER)).toEqual([event]);
    expect(selectEventStories([event], "important", PLAYER)).toEqual([]);
    const [row] = selectEventStories([event], "all", PLAYER);
    const root = createRoot(host);
    try {
      act(() => root.render(<StoryFeedRow event={row} />));
      expect(host.textContent).toContain(expected);
      expect([...host.querySelectorAll(".ui-tier")].map((gem) => gem.getAttribute("aria-label"))).toEqual(gems);
      expect(host.textContent).toContain("army");
      await act(async () => host.querySelector<HTMLButtonElement>("button")!.click());
      expect(game.navigate).toHaveBeenCalledOnce();
      expect(game.navigate.mock.calls[0][0].getContract()).toEqual({ x: 3, y: 4 });
    } finally {
      act(() => root.unmount());
    }
  },
);

it("says a clipped Log row whole on hover, its ranks as gems sized to the line", async () => {
  const payload = { explorer_id: 9, choice: "Battle", tier: 2, point_rank: 3, stamina: 40 };
  const presentation = buildStoryEventPresentation({
    storyType: "SkillPointSpent",
    storyPayload: payload,
    entityId: 9,
    ownerAddress: PLAYER,
  } as never);
  const event = { ...story("point", "SkillPointSpent", PLAYER, payload, presentation.title), presentation };
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () =>
      root.render(
        <>
          <Tooltip />
          <StoryFeedRow event={event} />
        </>,
      ),
    );
    const row = host.querySelector<HTMLElement>(".ui-event__text")!;
    // The row's description runs past its two lines.
    Object.defineProperty(row, "scrollHeight", { value: 60 });
    Object.defineProperty(row, "clientHeight", { value: 30 });
    const hover = new MouseEvent("pointerover", { bubbles: true, clientX: 10, clientY: 10 });
    Object.defineProperty(hover, "pointerType", { value: "mouse" });
    await act(async () => row.dispatchEvent(hover));
    const tip = document.querySelector('[role="tooltip"]')!;
    expect(tip.textContent).toBe(presentation.description);
    expect(
      [...tip.querySelectorAll(".ui-tier")].map((gem) => [
        gem.getAttribute("aria-label"),
        gem.getAttribute("data-size"),
      ]),
    ).toEqual([["III", "line"]]);
  } finally {
    await act(async () => root.unmount());
    useTooltipStore.setState({ tooltip: null });
  }
});
