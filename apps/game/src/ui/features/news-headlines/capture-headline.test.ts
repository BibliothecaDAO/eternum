import { expect, it } from "vitest";
import { aspectName, catalogAspectId, DEEP_BEASTS, DEEP_CAPTURE_LINES, deepSites } from "@bibliothecadao/types";
import { DEEP_CAPTURE_WORDS } from "@/ui/design-system/kit/words";
import { buildCaptureHeadline, buildDeepCaptureHeadline } from "./capture-headline";

const CAPTOR = 0xc1n;
const HOLDER = 0xa1n;
const capture = (previousOwner: bigint, viewer: bigint | null) =>
  buildCaptureHeadline({
    structureId: 5,
    isHyperstructure: false,
    structureName: "Stolsli",
    previousOwner,
    newOwner: CAPTOR,
    site: { x: 3, y: 4 },
    viewer,
    at: 1_000,
  });

it("tells the captor what they took from whom, and that its armies and deliveries came with it", () => {
  expect(capture(HOLDER, CAPTOR)).toMatchObject({
    type: "realm-fall",
    title: "Realm captured",
    description: [
      { player: CAPTOR },
      " took Stolsli from ",
      { player: HOLDER },
      ". Its armies and deliveries went with it.",
    ],
    location: { x: 3, y: 4, entityId: 5 },
  });
});

it("tells the player who lost it that it was taken from them, and what went with it", () => {
  expect(capture(HOLDER, HOLDER)).toMatchObject({
    title: "Realm lost",
    description: [{ player: CAPTOR }, " took Stolsli from ", "you", ". Its armies and deliveries went with it."],
  });
});

it("tells a bystander the fall, and nothing went with a structure no player held", () => {
  expect(capture(HOLDER, null).title).toBe("Realm falls");
  expect(capture(0n, CAPTOR).description).toEqual([{ player: CAPTOR }, " took Stolsli from ", "The Vanguard"]);
});

const SITE = deepSites.find(({ key }) => key === "altar")!.name;
const BEAST = DEEP_BEASTS.altar.name;
const deepCapture = (holderAspect: number | undefined, viewerAspects: number[]) =>
  buildDeepCaptureHeadline({
    structureId: 7,
    site: { name: SITE, icon: "flame", beast: BEAST, at: { x: 1, y: 2 } },
    newOwner: CAPTOR,
    takerAspect: 2,
    holderAspect,
    viewerAspects: new Set(viewerAspects),
    at: 9,
  });
const told = (headline: ReturnType<typeof deepCapture>) =>
  headline.type === "deep-capture" ? [headline.look, headline.title, headline.description] : null;

it("tells a Deep site taken from its beast, naming the beast it slew, in the gold of a capture", () => {
  expect(told(deepCapture(undefined, [2]))).toEqual([
    { icon: "flame", eyebrow: DEEP_CAPTURE_WORDS.eyebrow(aspectName(2)), aspect: catalogAspectId(2) },
    DEEP_CAPTURE_WORDS.taken(SITE),
    [{ player: CAPTOR }, DEEP_CAPTURE_WORDS.sentence(DEEP_CAPTURE_LINES.slew(aspectName(2), BEAST, SITE))],
  ]);
});

it("tells a Deep site seized from another Aspect: lost in red to that Aspect, seized in gold to everyone else", () => {
  const seized = [
    { player: CAPTOR },
    DEEP_CAPTURE_WORDS.sentence(DEEP_CAPTURE_LINES.seized(aspectName(2), SITE, aspectName(3))),
  ];
  expect(told(deepCapture(3, [3]))).toEqual([
    { icon: "flame", eyebrow: DEEP_CAPTURE_WORDS.siteLost, tone: "bad", aspect: catalogAspectId(2) },
    DEEP_CAPTURE_WORDS.lost(SITE),
    seized,
  ]);
  expect(told(deepCapture(3, [1]))).toEqual([
    { icon: "flame", eyebrow: DEEP_CAPTURE_WORDS.eyebrow(aspectName(2)), aspect: catalogAspectId(2) },
    DEEP_CAPTURE_WORDS.seized(SITE),
    seized,
  ]);
});
