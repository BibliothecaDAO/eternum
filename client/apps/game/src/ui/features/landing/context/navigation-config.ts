import { ArrowLeftRight, Home, Trophy, TrendingUp, User, type LucideIcon } from "lucide-react";

type SectionId = "home" | "leaderboard" | "markets" | "amm" | "profile";

interface SubMenuItem {
  id: string;
  label: string;
  /** Tab parameter value (used in URL query string) */
  tab: string | null;
  href: string;
}

interface SectionConfig {
  id: SectionId;
  label: string;
  icon: LucideIcon;
  /** Base route path for this section */
  basePath: string;
  subMenu: SubMenuItem[];
}

export const NAVIGATION_SECTIONS: SectionConfig[] = [
  {
    id: "home",
    label: "Home",
    icon: Home,
    basePath: "/",
    subMenu: [
      { id: "play", label: "PLAY", tab: null, href: "/" },
      { id: "learn", label: "LEARN", tab: "learn", href: "/learn" },
      { id: "news", label: "NEWS", tab: "news", href: "/news" },
      { id: "factory", label: "FACTORY", tab: "factory", href: "/factory" },
    ],
  },
  {
    id: "leaderboard",
    label: "Leaderboard",
    icon: Trophy,
    basePath: "/leaderboard",
    subMenu: [
      { id: "ranked", label: "RANKED", tab: null, href: "/leaderboard" },
      { id: "tournaments", label: "TOURNAMENTS", tab: "tournaments", href: "/leaderboard?tab=tournaments" },
    ],
  },
  {
    id: "markets",
    label: "Markets",
    icon: TrendingUp,
    basePath: "/markets",
    subMenu: [{ id: "markets", label: "MARKETS", tab: null, href: "/markets" }],
  },
  {
    id: "amm",
    label: "Agora",
    icon: ArrowLeftRight,
    basePath: "/amm",
    subMenu: [{ id: "amm", label: "AGORA", tab: null, href: "/amm" }],
  },
  {
    id: "profile",
    label: "Profile",
    icon: User,
    basePath: "/profile",
    subMenu: [
      { id: "profile", label: "PROFILE", tab: null, href: "/profile" },
      { id: "cosmetics", label: "COSMETICS", tab: "cosmetics", href: "/profile?tab=cosmetics" },
      { id: "wallet", label: "WALLET", tab: "wallet", href: "/profile?tab=wallet" },
    ],
  },
];

const HOME_SECTION_PATHS = new Set(["/", "/learn", "/news", "/factory"]);

/**
 * Get the section config for a given route path
 */
export function getSectionFromPath(pathname: string): SectionConfig {
  if (HOME_SECTION_PATHS.has(pathname)) {
    return NAVIGATION_SECTIONS[0];
  }

  for (const section of NAVIGATION_SECTIONS) {
    if (section.basePath !== "/" && pathname.startsWith(section.basePath)) {
      return section;
    }
  }

  return NAVIGATION_SECTIONS[0];
}

/**
 * Get the active submenu item from the current route context.
 */
export function getActiveSubItem(section: SectionConfig, pathname: string, searchParams: URLSearchParams): SubMenuItem {
  if (section.id === "home") {
    const match = section.subMenu.find((item) => item.href === pathname);
    return match ?? section.subMenu[0];
  }

  const tabParam = searchParams.get("tab");
  if (!tabParam) {
    return section.subMenu[0];
  }

  const match = section.subMenu.find((item) => item.tab === tabParam);
  return match ?? section.subMenu[0];
}

export function getSubItemHref(section: SectionConfig, item: SubMenuItem, searchParams: URLSearchParams): string {
  if (section.id === "home") {
    return item.href;
  }

  const nextSearchParams = new URLSearchParams(searchParams);
  if (item.tab === null) {
    nextSearchParams.delete("tab");
  } else {
    nextSearchParams.set("tab", item.tab);
  }

  const queryString = nextSearchParams.toString();
  return queryString ? `${section.basePath}?${queryString}` : section.basePath;
}
