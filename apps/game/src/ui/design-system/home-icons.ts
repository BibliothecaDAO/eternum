import { type RealmLevels } from "@bibliothecadao/types";
import skins from "@/three/structures/realm-skins.json";
import type { RealmSkin } from "@/three/structures/realm-skins";
import { iconDefinition, type IconMeaning } from "./icon-meaning";
import paintings from "./home-icons.json";
import { REALM } from "./kit/words";

export type HomeKind = "realm" | "wonder" | RealmSkin;

/** Every home kind has a distinct painting at every age; board captures read the same catalog. */
const icons = paintings satisfies Record<HomeKind, Record<RealmLevels, string>>;
export const HOME_KINDS = {
  realm: { label: REALM, icons: icons.realm },
  wonder: { label: "Wonder", icons: icons.wonder },
  devcon: { label: skins.devcon.label, icons: icons.devcon },
  "devcon-golden": { label: skins["devcon-golden"].label, icons: icons["devcon-golden"] },
} satisfies Record<HomeKind, { label: string; icons: Record<RealmLevels, string> }>;

export const homeKind = (skin?: RealmSkin, hasWonder = false): HomeKind => (hasWonder ? "wonder" : (skin ?? "realm"));

export function homeIcon(kind: HomeKind, level: number): IconMeaning {
  const levels: Readonly<Record<number, string>> = HOME_KINDS[kind].icons;
  const icon = levels[level];
  if (!Number.isInteger(level) || !icon) throw new Error(`Unknown realm level: ${level}`);
  const meaning = icon as IconMeaning;
  iconDefinition(meaning);
  return meaning;
}
