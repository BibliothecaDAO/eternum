import { expect, it } from "vitest";

import { messageWords, placeMetadata, placeOf } from "./place";

const MOONDEEP = { kind: "structure" as const, entityId: 4242, name: "Moondeep", icon: "ruin" as const, at: 1_000 };

it("reads back the place a message was sent with", () => {
  expect(placeOf(placeMetadata(MOONDEEP))).toEqual(MOONDEEP);
});

it("reads no place from a message that carries none, or a place that is not one", () => {
  expect(placeOf(undefined)).toBeNull();
  expect(placeOf({ replyTo: { id: "m1" } })).toBeNull();
  expect(placeOf({ place: { ...MOONDEEP, kind: "tile" } })).toBeNull();
  expect(placeOf({ place: { ...MOONDEEP, icon: "not-an-icon" } })).toBeNull();
  expect(placeOf({ place: { ...MOONDEEP, entityId: "4242" } })).toBeNull();
});

it("writes a message with its place after its words, and a place sent alone as its name", () => {
  expect(messageWords("meet me at", placeMetadata(MOONDEEP))).toBe("meet me at Moondeep");
  expect(messageWords("Moondeep", placeMetadata(MOONDEEP))).toBe("Moondeep");
  expect(messageWords("no place", undefined)).toBe("no place");
});
