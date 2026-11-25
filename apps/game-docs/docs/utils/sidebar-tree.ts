import SIDEBAR from "../../sidebar.json";
import BRAND from "../brand.gen.json";

export type GameId = keyof typeof BRAND.marks.lockups;

interface SidebarLeaf {
  readonly text: string;
  readonly link: string;
}

export interface SidebarNode {
  readonly text: string;
  readonly link?: string;
  readonly collapsed?: boolean;
  readonly kind?: "global" | "game" | "data" | "developers";
  readonly id?: GameId;
  readonly summary?: string;
  readonly items?: readonly SidebarNode[];
}

export interface GameSidebarSection extends SidebarNode {
  readonly kind: "game";
  readonly id: GameId;
  readonly summary: string;
  readonly items: readonly SidebarNode[];
}

const SECTIONS = SIDEBAR as readonly SidebarNode[];

const collectLeaves = (nodes: readonly SidebarNode[]): SidebarLeaf[] =>
  nodes.flatMap((node) => {
    const self: SidebarLeaf[] = node.link ? [{ text: node.text, link: node.link }] : [];
    return node.items ? [...self, ...collectLeaves(node.items)] : self;
  });

export const gameSections = (): readonly GameSidebarSection[] =>
  SECTIONS.filter(
    (section): section is GameSidebarSection => section.kind === "game" && Boolean(section.items?.length),
  );

export const firstLinkOf = (section: SidebarNode): string => {
  const first = section.items ? collectLeaves(section.items)[0] : undefined;
  if (!first) throw new Error(`Sidebar section "${section.text}" has no linked page`);
  return first.link;
};
