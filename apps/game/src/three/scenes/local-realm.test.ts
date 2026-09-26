import { describe, expect, it } from "vitest";
import { pickLocalRealm } from "./local-realm";

const frontier = { id: 1, frontier: true };
const blitz = { id: 2, frontier: false };
const followsTheDay = (structure: { frontier: boolean }) => structure.frontier;

describe("the realm the local view opens on", () => {
  it("is the structure at the route's hex, else the selected Frontier realm whose site moved with the day", () => {
    expect(pickLocalRealm({ atRoute: blitz, selected: frontier, followsTheDay })).toBe(blitz);
    // Yesterday's route: the Frontier realm now stands elsewhere, and the view still opens on it.
    expect(pickLocalRealm({ atRoute: undefined, selected: frontier, followsTheDay })).toBe(frontier);
    // A structure that never moves is only ever found where the route says.
    expect(pickLocalRealm({ atRoute: undefined, selected: blitz, followsTheDay })).toBeUndefined();
    expect(pickLocalRealm({ atRoute: undefined, selected: undefined, followsTheDay })).toBeUndefined();
  });
});
