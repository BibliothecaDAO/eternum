import { isRealmCategory } from "@bibliothecadao/eternum/expeditions";

import type { RealmSkinFacts } from "@/three/cosmetics/realm-skins";

import { type DirectoryGame, useDirectory } from "../herald";
import { playedSeasonGame } from "../value/holdings-pill";

export interface CosmeticStanding {
  readonly facts: RealmSkinFacts;
  readonly rank: number | null;
}

export const cosmeticStandingOf = (game: DirectoryGame | undefined): CosmeticStanding => {
  const state = game?.player_state;
  const realms = (state?.structures ?? []).filter((structure) => isRealmCategory(structure.category));
  return {
    facts: {
      sealHeld: state?.ancient_seal === true,
      aspect: realms.find((realm) => realm.aspect !== null)?.aspect ?? null,
      wonderAspect: realms.find((realm) => realm.has_wonder)?.aspect ?? null,
    },
    rank: realms.length > 0 ? Math.max(...realms.map((realm) => realm.level)) : null,
  };
};

export const useCosmeticStanding = (): CosmeticStanding => {
  const directory = useDirectory();
  return cosmeticStandingOf(playedSeasonGame(directory.data?.games ?? []));
};
