import { NavLink, useLocation } from "react-router-dom";

import { useIdentitySession } from "@/hooks/context/identity-session";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { playerPortraitUrl } from "@/services/identity/player-portrait";
import type { GameIcon } from "@/ui/design-system/atoms/game-icon";
import { BookOpen, Play, Trophy, User } from "@/ui/design-system/atoms/game-icons";
import { cn } from "@/ui/design-system/atoms/lib/utils";

import { IdentityChip } from "../identity-chip";
import { WORDS } from "../words";
import { Lockup } from "./lockup";

/** The app's four places, one list for both layouts: the phone's tab bar and the desktop top bar. */
const TABS: readonly { to: string; word: string; icon: GameIcon; matches: readonly string[] }[] = [
  { to: "/", word: WORDS.play, icon: Play, matches: ["/", "/blitz", "/frontier", "/eternum", "/dominion"] },
  { to: "/season", word: WORDS.season, icon: Trophy, matches: ["/season", "/results"] },
  { to: "/learn", word: WORDS.learn, icon: BookOpen, matches: ["/learn", "/terms", "/privacy"] },
  { to: "/profile", word: WORDS.profile, icon: User, matches: ["/profile", "/p/"] },
];

const PROFILE_TAB = TABS[3];
/** Desktop shows the first three in the bar; Profile is the player chip at its right. */
const DESKTOP_TABS = TABS.slice(0, 3);

const matchesPath = (pathname: string, match: string) =>
  match === "/" ? pathname === "/" : pathname.startsWith(match);

const useActiveTab = (): string | undefined => {
  const { pathname } = useLocation();
  return TABS.find((tab) => tab.matches.some((match) => matchesPath(pathname, match)))?.to;
};

/** Profile's icon is the player's portrait once signed in. */
const useSignedInPortrait = (): string | undefined => {
  const { session } = useIdentitySession();
  const address = useAccountStore((state) => state.account?.address);
  return session ? playerPortraitUrl(address, session.user.image) : undefined;
};

/** The phone's foot: four tabs in thumb reach. */
export const TabBar = () => {
  const active = useActiveTab();
  const portrait = useSignedInPortrait();
  return (
    <nav
      aria-label="Tabs"
      className="flex h-[calc(64px+env(safe-area-inset-bottom))] border-t border-kit-line bg-kit-ground px-2.5 pb-[env(safe-area-inset-bottom)]"
    >
      {TABS.map((tab) => {
        const current = active === tab.to;
        const Icon = tab.icon;
        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            data-role="tab"
            aria-current={current ? "page" : undefined}
            className={cn(
              "flex min-h-12 flex-1 flex-col items-center justify-center gap-[3px] font-ui text-[11px] font-semibold",
              current ? "text-kit-peach" : "text-kit-muted",
            )}
          >
            {tab === PROFILE_TAB && portrait ? (
              <img
                src={portrait}
                alt=""
                className={cn(
                  "size-7 rounded-full border-2 object-cover",
                  current ? "border-kit-peach" : "border-kit-line2",
                )}
              />
            ) : (
              <Icon size={28} className={current ? undefined : "brightness-[.8] grayscale-[.6]"} />
            )}
            {tab.word}
          </NavLink>
        );
      })}
    </nav>
  );
};

/**
 * The desktop's one top bar: the lockup, Play · Season · Learn, and the player chip (or Sign in) at the right; a
 * full-screen step keeps the lockup alone.
 */
export const TopNav = ({ places }: { places: boolean }) => {
  const active = useActiveTab();
  return (
    <header className="relative z-30 flex h-[68px] shrink-0 items-center gap-7 border-b border-kit-line bg-kit-ground px-10">
      <NavLink to="/" data-role="lockup" aria-label={WORDS.play}>
        <Lockup size="desktop" />
      </NavLink>
      {places && (
        <>
          <nav aria-label="Tabs" className="flex gap-1">
            {DESKTOP_TABS.map((tab) => {
              const current = active === tab.to;
              const Icon = tab.icon;
              return (
                <NavLink
                  key={tab.to}
                  to={tab.to}
                  data-role="tab"
                  aria-current={current ? "page" : undefined}
                  className={cn(
                    "flex h-12 items-center gap-2 rounded-xl px-4 font-ui text-[15px] font-semibold",
                    current ? "bg-kit-peach/[.07] text-kit-peach" : "text-kit-muted",
                  )}
                >
                  <Icon size={24} className={current ? undefined : "brightness-[.8] grayscale-[.6]"} />
                  {tab.word}
                </NavLink>
              );
            })}
          </nav>
          <div className="ml-auto" data-role="player">
            <IdentityChip />
          </div>
        </>
      )}
    </header>
  );
};
