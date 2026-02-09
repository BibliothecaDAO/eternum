import { Home, Trophy, TrendingUp, User, type LucideIcon } from "lucide-react";

type SectionId = "home" | "leaderboard" | "markets" | "profile";

interface SubMenuItem {
  id: string;
  label: string;
  /** Tab parameter value (used in URL query string) */
  tab: string | null;
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
      { id: "play", label: "PLAY", tab: null },
      { id: "learn", label: "LEARN", tab: "learn" },
      { id: "news", label: "NEWS", tab: "news" },
    ],
  },
  {
    id: "leaderboard",
    label: "Leaderboard",
    icon: Trophy,
    basePath: "/leaderboard",
    subMenu: [
      { id: "ranked", label: "RANKED", tab: null },
      { id: "tournaments", label: "TOURNAMENTS", tab: "tournaments" },
    ],
  },
  {
    id: "markets",
    label: "Markets",
    icon: TrendingUp,
    basePath: "/markets",
    subMenu: [
      { id: "live", label: "LIVE", tab: null },
      { id: "past", label: "PAST", tab: "past" },
    ],
  },
  {
    id: "profile",
    label: "Profile",
    icon: User,
    basePath: "/profile",
    subMenu: [
      { id: "profile", label: "PROFILE", tab: null },
      { id: "cosmetics", label: "COSMETICS", tab: "cosmetics" },
      { id: "wallet", label: "WALLET", tab: "wallet" },
    ],
  },
];

/**
 * Get the section config for a given route path
 */
export function getSectionFromPath(pathname: string): SectionConfig {
  // Check exact matches first, then prefix matches
  for (const section of NAVIGATION_SECTIONS) {
    if (section.basePath === "/" && pathname === "/") {
      return section;
    }
    if (section.basePath !== "/" && pathname.startsWith(section.basePath)) {
      return section;
    }
  }
  // Default to home
  return NAVIGATION_SECTIONS[0];
}

/**
 * Get the active submenu item based on tab query parameter
 */
export function getActiveSubItem(section: SectionConfig, tabParam: string | null): SubMenuItem {
  if (!tabParam) {
    // Return the default (first) item when no tab is specified
    return section.subMenu[0];
  }

  // Find matching tab
  const match = section.subMenu.find((item) => item.tab === tabParam);
  return match ?? section.subMenu[0];
}
