import type { HeraldPlayerStructure } from "@bibliothecadao/eternum/game-sync";
import { REALM_SKIN_FAMILIES } from "@bibliothecadao/eternum";
import { gameKey, getActiveGame } from "@/runtime/world/store";

import type { RealmSkinFacts } from "@/three/cosmetics/realm-skins";

import { type DirectoryGame, gameRefOf, useDirectory } from "../herald";
import { hasSeasonRealm, seasonRealm } from "../season-pick";
import { playedSeasonGame } from "../value/holdings-pill";

interface CosmeticStanding {
  readonly facts: RealmSkinFacts;
  readonly rank: number | null;
  readonly game: DirectoryGame | null;
  readonly realm: HeraldPlayerStructure | null;
}

const cosmeticStandingOf = (game: DirectoryGame | undefined): CosmeticStanding => {
  const realm = game ? seasonRealm(game) : null;
  return {
    facts: {
      sealHeld: game?.player_state?.ancient_seal === true,
      aspect: realm?.aspect ?? null,
      hasWonder: realm?.has_wonder ?? false,
      equipped: realm?.realm_skin ?? REALM_SKIN_FAMILIES.DEFAULT_REALM_SKIN,
    },
    rank: realm?.level ?? null,
    game: game ?? null,
    realm,
  };
};

export const useCosmeticStanding = (): CosmeticStanding => {
  const games = useDirectory().data?.games ?? [];
  const held = games.filter(hasSeasonRealm);
  const playable = held.filter((game) => game.realm_skin_enabled === true && game.status === "Live");
  const active = getActiveGame();
  const lastPlayed =
    active && playable.find((game) => game.mode === "frontier" && gameKey(gameRefOf(game)) === gameKey(active));
  return cosmeticStandingOf(
    lastPlayed || playedSeasonGame(playable) || playedSeasonGame(held) || playedSeasonGame(games),
  );
};
