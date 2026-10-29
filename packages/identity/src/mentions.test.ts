import { expect, it } from "vitest";

import { mentionCandidates, MENTIONS_PER_MESSAGE } from "./mentions";

it("reads each mention as the names it may be, longest first, ending where a name character stops", () => {
  expect(mentionCandidates("@Ser Ada, hold the gate")).toEqual([["Ser Ada", "Ser"]]);
  expect(mentionCandidates("gg @Corwin_2!")).toEqual([["Corwin_2"]]);
  expect(mentionCandidates("@Aldric and @Isolde")).toEqual([["Aldric and", "Aldric"], ["Isolde"]]);
});

it("finds no mention inside a word, nor a stretch the name rules refuse", () => {
  expect(mentionCandidates("write to ada@realms.test")).toEqual([]);
  expect(mentionCandidates("@ab")).toEqual([]);
  expect(mentionCandidates("@ alone is nothing")).toEqual([]);
  expect(mentionCandidates("@Averyveryverylongnamebeyond")).toEqual([]);
});

it("reads at most the first mentions of a long roll call", () => {
  const roll = Array.from({ length: 9 }, (_, index) => `@Player${index}`).join(" ");
  expect(mentionCandidates(roll).map((names) => names.at(-1))).toEqual(
    Array.from({ length: MENTIONS_PER_MESSAGE }, (_, index) => `Player${index}`),
  );
});
