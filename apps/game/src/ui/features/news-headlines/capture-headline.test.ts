import { expect, it } from "vitest";
import { buildCaptureHeadline } from "./capture-headline";

const CAPTOR = 0xc1n;
const HOLDER = 0xa1n;
const names = new Map([
  [CAPTOR, "clientlane"],
  [HOLDER, "uxplay"],
  [0n, "The Vanguard"],
]);

const capture = (previousOwner: bigint, viewer: bigint | null) =>
  buildCaptureHeadline({
    structureId: 5,
    isHyperstructure: false,
    structureName: "Stolsli",
    previousOwner,
    newOwner: CAPTOR,
    site: { x: 3, y: 4 },
    viewer,
    nameOf: (owner) => names.get(owner)!,
    at: 1_000,
  });

it("tells the captor what they took from whom, and that its armies and deliveries came with it", () => {
  expect(capture(HOLDER, CAPTOR)).toMatchObject({
    type: "realm-fall",
    title: "Realm captured",
    description: "clientlane took Stolsli from uxplay. Its armies and incoming deliveries went with it.",
    location: { x: 3, y: 4, entityId: 5 },
  });
});

it("tells the player who lost it that it was taken from them, and what went with it", () => {
  expect(capture(HOLDER, HOLDER)).toMatchObject({
    title: "Realm lost",
    description: "clientlane took Stolsli from you. Its armies and incoming deliveries went with it.",
  });
});

it("tells a bystander the fall, and nothing went with a structure no player held", () => {
  expect(capture(HOLDER, null).title).toBe("Realm falls");
  expect(capture(0n, CAPTOR).description).toBe("clientlane took Stolsli from The Vanguard");
});
