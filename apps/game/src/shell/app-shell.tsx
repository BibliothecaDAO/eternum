import { NavLink, Outlet, useLocation } from "react-router-dom";

import { Trophy } from "@/ui/design-system/atoms/game-icons";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { PersonGlyph, PlayGlyph } from "@/ui/features/frontier/glyphs";
import { useFrontierType } from "@/ui/features/frontier/use-frontier-type";
import { useBootDocumentState } from "@/ui/modules/boot-loader";
import { useOutsidePlaySession } from "@/utils/spectator-session";

import { IdentityChip } from "./identity-chip";

/** The player app's three places: play (home and the games), results, and the player's profile and account. */
const TABS = [
  { to: "/", label: "Play", icon: PlayGlyph, matches: ["/", "/play"] },
  { to: "/results", label: "Results", icon: Trophy, matches: ["/results"] },
  { to: "/account", label: "Profile", icon: PersonGlyph, matches: ["/account", "/p/"] },
] as const;

const FOOTER_LINKS = [
  { to: "/scroll", label: "Scroll" },
  { to: "/terms", label: "Terms" },
  { to: "/privacy", label: "Privacy" },
] as const;

const useActiveTab = (): string | undefined => {
  const { pathname } = useLocation();
  return TABS.find(({ matches }) =>
    matches.some((match) => (match === "/" ? pathname === "/" : pathname.startsWith(match))),
  )?.to;
};

/**
 * The app shell: every screen outside a game, in the player app's one visual system. A header with the wordmark and
 * the player's portrait (or Sign in); the three tabs as a top nav on desktop and a tab bar on a phone. It carries no
 * three.js and no game asset; a game loads only under `/g/:chain/:game`.
 */
export const AppShell = () => {
  useBootDocumentState("app-ready");
  // Back from a spectated game, the signed-in player is no spectator here.
  useOutsidePlaySession();
  // The shell wears the player app's one visual system, the same as Frontier's HUD.
  useFrontierType();
  const active = useActiveTab();

  return (
    <div className="flex min-h-screen flex-col bg-[#0c0a08] font-sans text-[#eadfc8]">
      <header className="sticky top-0 z-30 bg-gradient-to-b from-[#0c0a08] to-[#0c0a08]/70 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-4">
          <NavLink to="/" className="font-[Lexend] text-[22px] font-extrabold tracking-wide text-[#f3d08a]">
            REALMS
          </NavLink>
          <nav aria-label="Main navigation" className="hidden gap-6 lg:flex">
            {TABS.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                aria-current={active === tab.to ? "page" : undefined}
                className={cn(
                  "border-b-2 pb-1 font-[Lexend] text-[17px] font-extrabold",
                  active === tab.to ? "border-[#f6ac1d] text-[#f3d08a]" : "border-transparent text-[#a2926f]",
                )}
              >
                {tab.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto">
            <IdentityChip />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-3 pb-28 pt-2 lg:px-4 lg:pb-16">
        <Outlet />
      </main>

      <footer className="mx-auto flex w-full max-w-6xl gap-4 px-4 pb-24 text-[13px] text-[#6e6148] lg:pb-4">
        {FOOTER_LINKS.map((item) => (
          <NavLink key={item.to} to={item.to} className="hover:text-[#a2926f]">
            {item.label}
          </NavLink>
        ))}
      </footer>

      <TabBar active={active} />
    </div>
  );
};

/** On a phone the three places sit in a bar at the foot, in thumb reach. */
const TabBar = ({ active }: { active: string | undefined }) => (
  <nav
    aria-label="Tabs"
    className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t border-[#46351c] bg-[#0c0a08]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
  >
    {TABS.map((tab) => {
      const Icon = tab.icon;
      const current = active === tab.to;
      return (
        <NavLink
          key={tab.to}
          to={tab.to}
          aria-current={current ? "page" : undefined}
          className={cn(
            "flex flex-col items-center gap-1 py-2.5 font-[Lexend] text-[13px] font-extrabold",
            current ? "text-[#f3d08a]" : "text-[#6e6148]",
          )}
        >
          <Icon className={cn("size-7", current ? "drop-shadow-[0_0_8px_rgba(246,172,29,0.6)]" : "opacity-60")} />
          {tab.label}
        </NavLink>
      );
    })}
  </nav>
);
