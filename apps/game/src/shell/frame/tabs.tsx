import { NavLink, useLocation } from "react-router-dom";

import { useIdentitySession } from "@/hooks/context/identity-session";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { playerPortraitUrl } from "@/services/identity/player-portrait";
import type { GameIcon } from "@/ui/design-system/atoms/game-icon";
import { BookOpen, Play, Trophy, User } from "@/ui/design-system/atoms/game-icons";
import { cn } from "@/ui/design-system/atoms/lib/utils";

import { IdentityChip } from "../identity-chip";
import { WORDS } from "../words";
import { EnvChip } from "./env-mark";
import { Kbd } from "./kbd";

/** The app's four places, one list for both layouts: the phone's tab bar and the desktop rail. */
const TABS: readonly { to: string; word: string; icon: GameIcon; matches: readonly string[] }[] = [
  { to: "/", word: WORDS.play, icon: Play, matches: ["/", "/blitz", "/frontier", "/eternum", "/dominion"] },
  { to: "/season", word: WORDS.season, icon: Trophy, matches: ["/season", "/results"] },
  { to: "/learn", word: WORDS.learn, icon: BookOpen, matches: ["/learn", "/terms", "/privacy"] },
  { to: "/profile", word: WORDS.profile, icon: User, matches: ["/profile", "/p/"] },
];

const PROFILE_TAB = TABS[3];

/** The places' addresses in order: the desktop's keys 1–4 open them. */
export const PLACES = TABS.map((tab) => tab.to);

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
 * The desktop's rail, the full height of the window: the lockup, the four places with their keys, and the player (or
 * Sign in) at its foot; a full-screen step keeps the lockup alone.
 */
export const Rail = ({ places }: { places: boolean }) => {
  const active = useActiveTab();
  return (
    <header
      data-band="rail"
      className="sticky top-0 z-30 flex h-screen w-24 shrink-0 flex-col items-center gap-1 leather border-r pb-5 pt-5 min-[1800px]:w-28"
    >
      <NavLink to="/" data-role="lockup" aria-label={WORDS.play} className="mb-6 flex flex-col items-center gap-2">
        <img src="/images/logos/realms-lockup-stacked.svg" alt="Realms" className="block w-16" />
        <EnvChip />
      </NavLink>
      {places && (
        <>
          <nav aria-label="Tabs" className="flex w-full flex-col gap-1">
            {TABS.map((tab, index) => {
              const current = active === tab.to;
              const Icon = tab.icon;
              return (
                <NavLink
                  key={tab.to}
                  to={tab.to}
                  data-role="tab"
                  aria-current={current ? "page" : undefined}
                  className={cn(
                    "relative flex w-full flex-col items-center gap-1.5 py-3.5 font-ui text-[13px] transition-colors",
                    current
                      ? "bg-gradient-to-r from-kit-gold/[.18] to-transparent text-kit-cream before:absolute before:inset-y-2.5 before:left-0 before:w-1 before:rounded-r before:bg-kit-gold"
                      : "text-kit-muted hover:bg-kit-gold/[.05] hover:text-kit-cream",
                  )}
                >
                  <Icon size={30} className={current ? undefined : "brightness-[.8] grayscale-[.6]"} />
                  {tab.word}
                  <Kbd keyName={String(index + 1)} className="absolute right-2 top-2" />
                </NavLink>
              );
            })}
          </nav>
          <div className="mt-auto flex w-full justify-center" data-role="player">
            <IdentityChip />
          </div>
        </>
      )}
    </header>
  );
};
