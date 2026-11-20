import { expect, it } from "vitest";
import { NativeFactStore } from "../client/native-fact-store";
import { heldRealmForHome } from "./home-claim";

it("reads the NFT attached to a home independently of its original canonical traits", () => {
  const store = new NativeFactStore();
  store.applyFacts([{ model: "SettledRealm", key: "0x3:0x2c7", value: { game_id: 3, realm_id: 711, home: "412" } }]);
  expect(heldRealmForHome(store, { gameId: 3, entityId: 412n })).toBe(711);
  expect(heldRealmForHome(store, { gameId: 3, entityId: 413n })).toBeNull();
  expect(heldRealmForHome(store, { gameId: 4, entityId: 412n })).toBeNull();
});
