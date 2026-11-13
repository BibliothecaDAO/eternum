import { expect, it } from "vitest";

import type { ProcessedStoryEvent } from "@/hooks/store/use-story-events-store";
import type { AspectId } from "@bibliothecadao/types";

import { selectAspectFights } from "./aspect-fights";

const MIGHT = 1 as AspectId;
const CHAOS = 3 as AspectId;
const players = new Map<string, AspectId>([
  ["0xa1", MIGHT],
  ["0xa2", MIGHT],
  ["0xc1", CHAOS],
]);
const story = (id: string, story: string, participants: string[], at: number) =>
  ({ id, story, participants, timestampMs: at }) as unknown as ProcessedStoryEvent;

it("keeps the fights between players that one member of the Aspect took part in, newest first, against the other side's Aspect", () => {
  const fights = selectAspectFights(
    [
      story("older", "BattleEvent", ["0xa1", "0xc1"], 1_000),
      story("newer", "BattleEvent", ["0xc1", "0xa2"], 2_000),
      // Two members of Might: no fight of the Aspect's against another.
      story("mates", "BattleEvent", ["0xa1", "0xa2"], 3_000),
      // A beast or a site's guard: one player only.
      story("beast", "BattleEvent", ["0xa1"], 4_000),
      // A player in no Aspect the store knows: no Aspect to name.
      story("stranger", "BattleEvent", ["0xa1", "0xdead"], 5_000),
      // Not a battle.
      story("raid", "RaidEvent", ["0xa1", "0xc1"], 6_000),
      // Chaos against Chaos is not Might's.
      story("others", "BattleEvent", ["0xc1", "0xc1"], 7_000),
    ],
    players,
    MIGHT,
  );
  expect(fights.map(({ event, against }) => ({ id: event.id, against }))).toEqual([
    { id: "newer", against: CHAOS },
    { id: "older", against: CHAOS },
  ]);
});

it("shows the twelve newest fights", () => {
  const many = Array.from({ length: 20 }, (_, index) => story(`f${index}`, "BattleEvent", ["0xa1", "0xc1"], index));
  const fights = selectAspectFights(many, players, MIGHT);
  expect(fights).toHaveLength(12);
  expect(fights[0]!.event.id).toBe("f19");
});
