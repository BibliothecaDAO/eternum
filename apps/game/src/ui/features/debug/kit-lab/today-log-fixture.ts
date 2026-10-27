import { buildStoryEventPresentation } from "@bibliothecadao/eternum";
import { dayLogLine } from "@/ui/features/frontier/log/day-line";
import { campBeside, SITE } from "@/ui/features/frontier/sites/site-fixture";
import { RESOURCE_PRECISION, ResourcesIds, StructureType } from "@bibliothecadao/types";

/** The two weak beasts the owner cleared on prod on 22 October, by their starting guards (339 and 317). */
const BEASTS = [
  { id: 711, guard: 339n },
  { id: 712, guard: 317n },
] as const;
const troops = (count: bigint) => String(count * BigInt(RESOURCE_PRECISION));

/**
 * Today as the owner's army played it on prod on 22 October (army 2536, game 1): its reveals, its four level-ups, the
 * two weak beasts it cleared, the fight the rift's guard held, then the rift's clear. Each story goes through the day
 * log's own line, over the sites fixture with prod's XP rules, so the sheet shows what Today writes for it.
 */
export const ownerDayLog = (now: number) => {
  const { store } = campBeside("Rift");
  store.applyFacts([
    {
      model: "ArmyProgressionRules",
      key: "0x101",
      value: {
        common_xp: 100,
        game_id: 1,
        reveal_xp: 2,
        fixed_xp: 200,
        uncommon_xp: 250,
        rare_xp: 500,
        epic_xp: 900,
        legendary_xp: 1500,
      },
    },
    ...BEASTS.map(({ id, guard }, index) => ({
      model: "ExpeditionSite",
      key: `0x7${index + 7}`,
      value: {
        game_id: 1,
        entity_id: id,
        category: StructureType.Beasts,
        initial_guard_count: troops(guard),
        alt: false,
        col: 44 + index,
        row: 12,
        clear: { explorer_id: 201, home_id: 7, reward: null },
      },
    })),
  ] as never);
  const reveal = { resource_type: ResourcesIds.Labor, amount: "78500000000" };
  const tier = (title: string) => ({ story: "SkillPointSpent", storyPayload: {}, title });
  const cleared = (site: number, title: string) => ({
    story: "SitePayout",
    storyPayload: { site_id: site, reward: null },
    title,
  });
  const day = [
    cleared(SITE, "Rift cleared"),
    tier("Scouting Uncommon"),
    {
      story: "BattleEvent",
      storyPayload: {
        defender_id: SITE,
        attacker: { before: troops(1_415n), after: troops(1_093n) },
        defender: { before: troops(1_100n), after: troops(464n) },
      },
      title: "Guard holds",
    },
    tier("Battle Uncommon"),
    { story: "ExplorationReward", storyPayload: reveal, title: "Explored" },
    cleared(BEASTS[1].id, "Beasts cleared"),
    { story: "ExplorationReward", storyPayload: reveal, title: "Explored" },
    cleared(BEASTS[0].id, "Beasts cleared"),
    tier("Logistics Rare"),
    tier("Logistics Uncommon"),
  ];
  return day.flatMap(({ story, storyPayload, title }, index) => {
    const text = dayLogLine({ story, storyPayload, presentation: { title } }, store);
    return text === null ? [] : [{ id: `owner-${index}`, at: now - index * 4 * 60, text }];
  });
};

/** Next season's recorded site uses, including a well limited by the army's remaining capacity. */
export const siteUseDayLog = (now: number) => {
  const { store } = campBeside();
  return [{ Shrine: 200 }, { Well: 60 }, { Well: 5 }, { Well: 0 }].map((benefit, index) => {
    const storyPayload = { explorer_id: 201, coord: { x: 41, y: 12 }, benefit };
    const presentation = buildStoryEventPresentation(
      { storyType: "SiteUsed", storyPayload, entityId: 201, ownerAddress: "0x111", viewerAddress: "0x111" } as never,
      store,
    );
    return {
      id: `site-use-${index}`,
      at: now - index * 60,
      text: dayLogLine({ story: "SiteUsed", storyPayload, presentation }, store)!,
    };
  });
};
