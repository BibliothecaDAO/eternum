import { buildStoryEventPresentation } from "@bibliothecadao/eternum";
import { siteName, StructureType } from "@bibliothecadao/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import { campBeside, SITE } from "../sites/site-fixture";
import { fightLogLine } from "./fight-line";

const troops = (whole: number) => String(BigInt(whole) * 1_000_000_000n);
const side = (player: string, before: number, after: number) => ({
  player,
  category: "Knight",
  tier: "T1",
  before: troops(before),
  after: troops(after),
  roll: 0,
});
/** The player's army 201 against the site's guard, as the chain records the battle. */
const battle = (guardAfter: number) => ({
  story: "BattleEvent",
  storyPayload: {
    attacker_id: 201,
    defender_id: SITE,
    attacker: side("0x123", 500, 432),
    defender: side("0x0", 334, guardAfter),
  },
});
const clear = {
  story: "SitePayout",
  storyPayload: { structure_id: 7, explorer_id: 201, site_id: SITE, category: StructureType.Camp, reward: null },
};
type Story = typeof clear | ReturnType<typeof battle>;

/** How the Events feed and the Log present a story, as the story store builds it. */
const present = (story: Story, store: ReturnType<typeof campBeside>["store"]) =>
  buildStoryEventPresentation(
    {
      ownerAddress: "0x123",
      ownerName: null,
      entityId: 7,
      txHash: "0x1",
      timestamp: 0,
      storyType: story.story,
      storyPayload: story.storyPayload,
    } as never,
    store,
    () => "clientlane",
  );
const title = (story: Story, store: ReturnType<typeof campBeside>["store"]) => present(story, store).title;

/** A fight's site in every place a player reads it: Events and Log (the story's title), and Today (its own line). */
const names = (store: ReturnType<typeof campBeside>["store"]) => ({
  events: title(battle(0), store),
  today: fightLogLine(battle(150), store),
  cleared: title(clear, store),
});

afterEach(() => vi.unstubAllGlobals());

describe("a fight's site, by one name on Events, Log and Today (live-qa-night P3-5)", () => {
  it("names the site as its map label and its clear do, never by its guard's species", () => {
    const { store } = campBeside("Camp");
    const site = siteName(SITE);
    expect(names(store)).toEqual({
      events: `clientlane vs ${site} · Victory`,
      today: `${site}: Guard holds, lost 68, guard 334 to 150`,
      cleared: `${site} cleared`,
    });
    // The species is the guard's kind: the fight's record still says what fought.
    expect(present(battle(0), store).description).toContain("Defender forces: Troll [");
  });

  it("names a site this client never synced the same way, never as a beast guard", () => {
    const { store } = campBeside("Camp");
    store.applyFacts([
      { model: "ExpeditionSite", key: "0x72", value: null },
      { model: "Structure", key: "0x71", value: null },
      { model: "Guard", key: "0x73", value: null },
    ] as never);
    expect(title(battle(0), store)).toBe(`clientlane vs ${siteName(SITE)} · Victory`);
    expect(title(clear, store)).toBe(`${siteName(SITE)} cleared`);
  });

  it("follows the name its holder gave it everywhere", () => {
    vi.stubGlobal("localStorage", { getItem: (key: string) => (key === `entity-name-${SITE}` ? "North Watch" : null) });
    const { store } = campBeside("Rift");
    expect(names(store)).toEqual({
      events: "clientlane vs North Watch · Victory",
      today: "North Watch: Guard holds, lost 68, guard 334 to 150",
      cleared: "North Watch cleared",
    });
  });
});
