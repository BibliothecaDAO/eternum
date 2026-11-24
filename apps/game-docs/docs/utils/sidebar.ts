export interface SidebarLink {
  readonly text: string;
  readonly link: string;
  readonly quick?: true;
}

export interface SidebarSection {
  readonly text: string;
  readonly collapsed?: true;
  readonly items: readonly SidebarLink[];
}

const SIDEBAR_SECTIONS: readonly SidebarSection[] = [
  {
    text: "Your account",
    items: [
      { text: "Sign in", link: "/account/sign-in" },
      { text: "Payout wallet", link: "/account/payout-wallet" },
      { text: "LORDS", link: "/account/lords" },
    ],
  },
  {
    text: "Start here",
    items: [{ text: "Frontier", link: "/frontier" }],
  },
  {
    text: "Your realm",
    items: [
      { text: "Realm and research", link: "/frontier/realm" },
      { text: "Buildings", link: "/frontier/buildings", quick: true },
      { text: "Daily quests", link: "/frontier/quests" },
    ],
  },
  {
    text: "Armies",
    items: [
      { text: "Troops and stamina", link: "/frontier/armies" },
      { text: "Combat", link: "/frontier/combat", quick: true },
      { text: "Oaths", link: "/frontier/oaths", quick: true },
      { text: "Relics", link: "/frontier/relics", quick: true },
    ],
  },
  {
    text: "Exploring",
    items: [
      { text: "The expedition", link: "/frontier/expedition" },
      { text: "Beasts", link: "/frontier/beasts", quick: true },
    ],
  },
  {
    text: "The Deep",
    items: [
      { text: "The Deep", link: "/frontier/deep" },
      { text: "Banes and Triumphs", link: "/frontier/banes" },
    ],
  },
  {
    text: "The season",
    items: [{ text: "Aspects and rewards", link: "/frontier/aspects" }],
  },
  {
    text: "Shop and friends",
    items: [{ text: "Shop and referrals", link: "/frontier/shop-and-referrals" }],
  },
  {
    text: "Data and developers",
    collapsed: true,
    items: [
      { text: "Get the data", link: "/data/get-the-data" },
      { text: "Getting started", link: "/development/getting-started" },
      { text: "Client", link: "/development/client" },
      { text: "Contracts", link: "/development/contracts" },
    ],
  },
];

export const DOCS_SIDEBAR = SIDEBAR_SECTIONS.map(({ text, collapsed, items }) => ({
  text,
  ...(collapsed ? { collapsed } : {}),
  items: items.map(({ text: itemText, link }) => ({ text: itemText, link })),
}));

export const HOME_QUICK_LINKS: readonly SidebarLink[] = SIDEBAR_SECTIONS.flatMap((section) =>
  section.items.filter((item) => item.quick),
);
