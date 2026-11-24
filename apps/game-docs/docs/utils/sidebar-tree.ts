import SIDEBAR from "../../sidebar.json";

export interface SidebarLeaf {
  readonly text: string;
  readonly link: string;
  readonly quick?: boolean;
}

export interface SidebarNode {
  readonly text: string;
  readonly link?: string;
  readonly quick?: boolean;
  readonly collapsed?: boolean;
  readonly kind?: "global" | "game" | "data" | "developers";
  readonly id?: string;
  readonly summary?: string;
  readonly items?: readonly SidebarNode[];
}

export interface GameSidebarSection extends SidebarNode {
  readonly kind: "game";
  readonly id: string;
  readonly summary: string;
  readonly items: readonly SidebarNode[];
}

const SECTIONS = SIDEBAR as readonly SidebarNode[];

const collectLeaves = (nodes: readonly SidebarNode[]): SidebarLeaf[] =>
  nodes.flatMap((node) => {
    const self: SidebarLeaf[] = node.link ? [{ text: node.text, link: node.link, quick: node.quick }] : [];
    return node.items ? [...self, ...collectLeaves(node.items)] : self;
  });

export const gameSections = (): readonly GameSidebarSection[] =>
  SECTIONS.filter(
    (section): section is GameSidebarSection => section.kind === "game" && Boolean(section.items?.length),
  );

export const leavesForKind = (kind: "global" | "data"): readonly SidebarLeaf[] => {
  const section = SECTIONS.find((entry) => entry.kind === kind);
  return section?.items ? collectLeaves(section.items) : [];
};

export const firstLinkOf = (section: SidebarNode): string => {
  const first = section.items ? collectLeaves(section.items)[0] : undefined;
  if (!first) throw new Error(`Sidebar section "${section.text}" has no linked page`);
  return first.link;
};

export const quickLinksForGame = (gameId: string): readonly SidebarLeaf[] => {
  const game = gameSections().find((section) => section.id === gameId);
  if (!game) return [];
  return collectLeaves(game.items).filter((item) => item.quick);
};
