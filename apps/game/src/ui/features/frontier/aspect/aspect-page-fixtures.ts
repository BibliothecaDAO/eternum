import { raceStage } from "@bibliothecadao/eternum/game-client";
import { aspects, type AspectId } from "@bibliothecadao/types";

import type { AspectMember, AspectPageProps, AspectStanding, OwnAspect } from "./aspect-page-view";

/** Season 1's race: a hyperstructure of 10,000 in 5 stages of 2,000; each of the first 4 stages is a Triumph. */
const FINISH = 10_000;
const STAGE = 2_000;
const STAGES = 5;
/** The bane bar of 1,500 an Aspect fills by holding the Altar. */
const BANE_THRESHOLD = 1_500;

/** Four Aspects ranked by height: the stage being built follows from the height, and an Aspect is finished at 10,000. */
const aspectIdByName = (name: string): AspectId => aspects.find((each) => each.name === name)!.id;

const standings = (heights: Record<string, number>, own: string): AspectStanding[] =>
  Object.entries(heights)
    .toSorted(([, a], [, b]) => b - a)
    .map(([aspect, height], index) => ({
      aspectId: aspectIdByName(aspect),
      rank: index + 1,
      height,
      stage: raceStage(height, STAGE),
      finished: height >= FINISH,
      own: aspect === own,
    }));

const member = (id: string, realm: string, glory: number, mine = false): AspectMember => ({
  id,
  realm,
  mine,
  glory,
});

const luminary = (charge: number): OwnAspect => ({
  aspectId: 2,
  bar: { charge, threshold: BANE_THRESHOLD },
  members: [
    member("a", "Aldor", 1_240),
    member("b", "Brek", 980, true),
    member("c", "Corva", 710),
    member("d", "Dunmere", 655),
    member("e", "Elsen", 310),
    member("f", "Farrow", 95),
  ],
});

/** The Aspect page's states on fixtures of its props: what the lab draws and the test asserts. */
export const ASPECT_PAGE_CASES = {
  "Mid-season, the player's Aspect second": {
    race: {
      standings: standings({ Prowess: 6_400, Luminary: 5_200, Havoc: 2_800, Insight: 900 }, "Luminary"),
      finishHeight: FINISH,
      stages: STAGES,
      result: null,
    },
    own: luminary(300),
  },
  "Age won by another Aspect": {
    race: {
      standings: standings({ Prowess: 10_000, Luminary: 7_600, Havoc: 4_100, Insight: 3_900 }, "Luminary"),
      finishHeight: FINISH,
      stages: STAGES,
      result: { winner: "Prowess" },
    },
    own: luminary(1_200),
  },
  "No Aspect": {
    race: {
      standings: standings({ Prowess: 3_000, Luminary: 2_400, Havoc: 1_100, Insight: 0 }, ""),
      finishHeight: FINISH,
      stages: STAGES,
      result: null,
    },
    own: null,
  },
  "Facts not settled": { race: null, own: null },
} as const satisfies Record<string, Omit<AspectPageProps, "onClose">>;
