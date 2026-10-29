import { describe, expect, it } from "vitest";

import { APP_ADDRESS, isRealmsSite } from "./app-address";

describe("Realms' own sites", () => {
  it.each([
    APP_ADDRESS,
    "https://docs.realms.party/frontier/expedition",
    "https://realms.world",
    "https://realms.market/x",
  ])("opens %s as Realms' own", (address) => expect(isRealmsSite(new URL(address))).toBe(true));

  it.each([
    "https://www.youtube.com/watch?v=1",
    "https://realms.party.evil.example/claim",
    "https://notrealms.party/claim",
    "http://docs.realms.party/",
  ])("asks before leaving for %s", (address) => expect(isRealmsSite(new URL(address))).toBe(false));
});
