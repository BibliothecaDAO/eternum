import { deepSites } from "@bibliothecadao/types";

import type { AspectMember, AspectPageProps, AspectStanding, AspectTriumph, OwnAspect } from "./aspect-page-view";

/** Season 1's race: a hyperstructure of 10,000 in 5 stages of 2,000; each of the first 4 stages is a Triumph. */
const FINISH = 10_000;
const STAGE = 2_000;
const STAGES = 5;
const TRIUMPH_STAGES = [1, 2, 3, 4] as const;
/** The bane bar of 1,500 an Aspect fills by holding the Altar. */
const BANE_THRESHOLD = 1_500;

/** Four Aspects ranked by height: the stage being built follows from the height, and an Aspect is finished at 10,000. */
const standings = (heights: Record<string, number>, own: string): AspectStanding[] =>
  Object.entries(heights)
    .toSorted(([, a], [, b]) => b - a)
    .map(([aspect, height], index) => ({
      aspect,
      rank: index + 1,
      height,
      stage: Math.min(STAGES, Math.floor(height / STAGE) + 1),
      finished: height >= FINISH,
      own: aspect === own,
    }));

/** A Triumph falls the day after its stage is built (at 2,000, 4,000, 6,000, 8,000): `builtOn` is those stages' days. */
const triumphs = (height: number, builtOn: readonly number[]): AspectTriumph[] =>
  TRIUMPH_STAGES.map((stage) => ({ stage, day: height >= stage * STAGE ? builtOn[stage - 1]! : null }));

const member = (id: string, realm: string, glory: number, guards: string | null, mine = false): AspectMember => ({
  id,
  realm,
  mine,
  glory,
  guards,
});
const [foundation, quarry, altar] = deepSites.map(({ name }) => name);

const harmony = (height: number, charge: number): OwnAspect => ({
  aspect: "Harmony",
  triumphs: triumphs(height, [11, 18]),
  bar: { charge, threshold: BANE_THRESHOLD },
  members: [
    member("a", "Aldor", 1_240, foundation!),
    member("b", "Brek", 980, altar!, true),
    member("c", "Corva", 710, null),
    member("d", "Dunmere", 655, quarry!),
    member("e", "Elsen", 310, null),
    member("f", "Farrow", 95, null),
  ],
});

/** The Aspect page's states on fixtures of its props: what the lab draws and the test asserts. */
export const ASPECT_PAGE_CASES = {
  "Mid-season, the player's Aspect second": {
    race: {
      standings: standings({ Might: 6_400, Harmony: 5_200, Chaos: 2_800, Guile: 900 }, "Harmony"),
      finishHeight: FINISH,
      stages: STAGES,
      winner: null,
    },
    own: harmony(5_200, 300),
  },
  "Age won by another Aspect": {
    race: {
      standings: standings({ Might: 10_000, Harmony: 7_600, Chaos: 4_100, Guile: 3_900 }, "Harmony"),
      finishHeight: FINISH,
      stages: STAGES,
      winner: "Might",
    },
    own: harmony(7_600, 1_200),
  },
  "No Aspect": {
    race: {
      standings: standings({ Might: 3_000, Harmony: 2_400, Chaos: 1_100, Guile: 0 }, ""),
      finishHeight: FINISH,
      stages: STAGES,
      winner: null,
    },
    own: null,
  },
  "Facts not settled": { race: null, own: null },
} as const satisfies Record<string, Omit<AspectPageProps, "onClose">>;
