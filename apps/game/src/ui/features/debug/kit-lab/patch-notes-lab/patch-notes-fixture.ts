import type { PatchNote } from "@/shell/news/patch-notes";

/**
 * Draft patch notes for the What's new options: the coming release and the 5 June 2026 one from the docs' changelog.
 * Every number is the preset's (config/source/frontier/base.ts, config/source/blitz/balance.ts,
 * config/source/eternum/troop.ts) or the docs' entry for 5 June 2026.
 */
export const DRAFT_PATCH_NOTES: readonly PatchNote[] = [
  {
    date: "2026-10-29",
    title: "Season one",
    summary: "Frontier opens, Blitz armies pay to march, and the map reads at a glance.",
    modes: {
      frontier: [
        {
          kind: "new",
          icon: "realm",
          title: "Frontier opens",
          line: "Frontier: a new land every day, and your realm keeps what it earns. Free to play, never raided.",
        },
        {
          kind: "new",
          icon: "military",
          title: "Armies per realm",
          line: "A realm fields 3 armies at once; its castle raises that to 4, 5 and 6.",
        },
        {
          kind: "new",
          icon: "stamina",
          title: "Stamina",
          line: "An army holds 150 stamina. Revealing a tile costs 30, a step over known ground 10.",
        },
        {
          kind: "new",
          icon: "wheat",
          title: "Wheat on the march",
          line: "Every step and every reveal costs 0.02 wheat per troop.",
        },
      ],
      blitz: [
        {
          kind: "balance",
          icon: "wheat",
          title: "Wheat on the march",
          line: "Moving and exploring cost wheat per troop: a big army needs farms behind it.",
          from: "0.03",
          to: "0.05",
        },
        {
          kind: "balance",
          icon: "explore",
          title: "Exploring caps at 3,000",
          line: "A reveal pays on at most 3,000 strength: explore with small armies, fight with big ones.",
        },
        {
          kind: "balance",
          icon: "camp",
          title: "Guards",
          line: "Camp and rift guards hold 999 to 1,499 troops; hyperstructure guards 1,499 to 1,999.",
        },
        {
          kind: "fix",
          icon: "move",
          title: "Selection holds",
          line: "Your army stays selected after its order lands.",
        },
      ],
      eternum: [],
    },
  },
  {
    date: "2026-06-05",
    title: "Combat v3",
    summary: "Crossbowmen fire from range, Knights take walls, and timed relics last three days.",
    modes: {
      frontier: [],
      blitz: [
        {
          kind: "balance",
          icon: "crossbowman-t1",
          title: "Crossbow range",
          line: "Crossbowmen attack from 2 hexes away; Knights and Paladins stay adjacent.",
        },
        {
          kind: "balance",
          icon: "knight-t1",
          title: "Knights take walls",
          line: "Knights deal 15% more assaulting structure guards, and Knight guards take 15% less.",
        },
        {
          kind: "balance",
          icon: "stamina",
          title: "Stamina recovery",
          line: "Stamina recovers 30 a phase, 180 an Eternum day.",
        },
      ],
      eternum: [
        {
          kind: "balance",
          icon: "crossbowman-t1",
          title: "Crossbow range",
          line: "Crossbowmen attack from 2 hexes away; Knights and Paladins stay adjacent.",
        },
        {
          kind: "balance",
          icon: "knight-t1",
          title: "Knights take walls",
          line: "Knights deal 15% more assaulting structure guards, and Knight guards take 15% less.",
        },
      ],
    },
  },
];
