import type { NativeFactStore } from "../client/native-fact-store";

/** The NFT backing this home; its canonical ID can differ from the home founded before it arrived. */
export function heldRealmForHome(
  facts: Pick<NativeFactStore, "inGame">,
  home: { gameId: number; entityId: bigint | number },
): number | null {
  for (const settled of facts.inGame("SettledRealm", home.gameId))
    if (settled.home === BigInt(home.entityId)) return settled.realm_id;
  return null;
}
