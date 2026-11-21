import { type RealmLevels } from "@bibliothecadao/types";
import { iconDefinition, type IconMeaning } from "./icon-meaning";
import paintings from "./home-icons.json";
import { REALM } from "./kit/words";

export type HomeKind = "realm" | "wonder";

/** Every home kind has a distinct painting at every age; board captures read the same catalog. */
const icons = paintings satisfies Record<HomeKind, Record<RealmLevels, string>>;
export const HOME_KINDS = {
  realm: { label: REALM },
  wonder: { label: "Wonder" },
} satisfies Record<HomeKind, { label: string }>;

export const homeKind = (hasWonder = false): HomeKind => (hasWonder ? "wonder" : "realm");

export function homeIcon(kind: keyof typeof icons, level: number): IconMeaning {
  const levels: Readonly<Record<number, string>> = icons[kind];
  const icon = levels[level];
  if (!Number.isInteger(level) || !icon) throw new Error(`Unknown realm level: ${level}`);
  const meaning = icon as IconMeaning;
  iconDefinition(meaning);
  return meaning;
}
