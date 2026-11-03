import { expect, it } from "vitest";
import { NativeFactStore } from "../client/native-fact-store";
import { heldRealmForHome, homeDailyClaim } from "./home-claim";

it("reads the NFT attached to a home independently of its original canonical traits", () => {
  const store = new NativeFactStore();
  store.applyFacts([
    {
      model: "LaborRules",
      key: "0x3",
      value: { game_id: 3, amount: "1000", campaign_essence: "1000", golden_amount: "2000", golden_essence: "2000" },
    },
    { model: "SettledRealm", key: "0x3:0x2c7", value: { game_id: 3, realm_id: 711, home: "412" } },
  ]);
  const home = { gameId: 3, entityId: 412n };
  expect(heldRealmForHome(store, home)).toBe(711);
  expect(homeDailyClaim(store, home)).toEqual({ labor: 1000, essence: 0 });
  expect(homeDailyClaim(store, { gameId: 3, entityId: 413n })).toBeNull();
  expect(heldRealmForHome(store, { gameId: 4, entityId: 412n })).toBeNull();
  store.applyFacts([
    { model: "CampaignHome", key: "0x3:0x19d", value: { game_id: 3, home: "413", campaign_id: "1", tier: 2 } },
  ]);
  expect(homeDailyClaim(store, { gameId: 3, entityId: 413n })).toEqual({ labor: 2000, essence: 2000 });
});
