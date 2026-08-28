import { Bug, Home, type LucideIcon } from "lucide-react";

type SectionId = "home" | "debug";

interface SubMenuItem {
  id: string;
  label: string;
  /** Tab parameter value (used in URL query string) */
  tab: string | null;
  href: string;
  /** When true, the nav item is rendered with a prominent call-to-action style */
  primary?: boolean;
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
      { id: "factory", label: "CREATE GAME", tab: "factory", href: "/factory", primary: true },
    ],
  },
  ...buildDebugNavigationSections(),
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

  if (section.id === "debug") {
    return section.subMenu.find((item) => item.href === pathname) ?? section.subMenu[0];
  }

  const tabParam = searchParams.get("tab");
  if (!tabParam) {
    return section.subMenu[0];
  }

  const match = section.subMenu.find((item) => item.tab === tabParam);
  return match ?? section.subMenu[0];
}

export function getSubItemHref(section: SectionConfig, item: SubMenuItem, searchParams: URLSearchParams): string {
  if (section.id === "home" || section.id === "debug") {
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

function buildDebugNavigationSections(): SectionConfig[] {
  if (!import.meta.env.DEV) {
    return [];
  }

  return [
    {
      id: "debug",
      label: "Debug",
      icon: Bug,
      basePath: "/debug",
      subMenu: [
        { id: "three-chunks", label: "CHUNKS", tab: null, href: "/debug/three-chunks" },
        { id: "procedural-characters", label: "CHARACTERS", tab: null, href: "/debug/procedural-characters" },
        {
          id: "procedural-character-benchmark",
          label: "BENCHMARK",
          tab: null,
          href: "/debug/procedural-character-benchmark",
        },
      ],
    },
  ];
}
