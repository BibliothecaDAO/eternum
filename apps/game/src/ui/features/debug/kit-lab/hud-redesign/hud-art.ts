import type { IconCode } from "@/ui/design-system/kit/kit-icon";
import { iconArt } from "../icon-art";

export const facets = (id: string, size = 64) => iconArt("faceted", id, size);

export const hudKitArt = {
  Cs: facets("realm"),
  Cp: facets("camp"),
  Ey: facets("explore"),
  Bt: facets("move"),
  Ct: facets("chat"),
  Tp: facets("victory"),
} satisfies Partial<Record<IconCode, string>>;

export const resourceArt: Record<string, string> = {
  Wheat: facets("wheat"),
  Wood: facets("wood"),
  Stone: facets("stone"),
  Knight: facets("knight"),
};

export const commandArt = {
  build: facets("build"),
  production: facets("settings"),
  military: facets("attack"),
  transfer: facets("move"),
  trade: facets("trade"),
};

export const minimapArt = {
  armyMine: facets("map-army", 16),
  armyEnemy: facets("map-army", 16),
  realmMine: facets("map-realm", 16),
  realmEnemy: facets("map-realm", 16),
  villageMine: facets("map-realm", 16),
  villageEnemy: facets("map-realm", 16),
  hyperstructure: facets("hyperstructure", 16),
  fragmentMine: facets("fragment", 16),
  chest: facets("chest", 16),
};
