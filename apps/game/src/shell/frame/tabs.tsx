import { NavLink, useLocation } from "react-router-dom";

import { useIdentitySession } from "@/hooks/context/identity-session";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { playerPortraitUrl } from "@/services/identity/player-portrait";
import type { GameIcon } from "@/ui/design-system/atoms/game-icon";
import { Play, Trophy, User } from "@/ui/design-system/atoms/game-icons";
import { cn } from "@/ui/design-system/atoms/lib/utils";

import { WORDS } from "../words";
import { EnvChip } from "./env-mark";
import { Kbd } from "./kbd";

/**
 * The app's three places, one list for both layouts: the phone's tab bar and the desktop rail. Play holds what to do
 * now, Season where the player stands, You the player, their finished games and everything about the account.
 */
const TABS: readonly { to: string; word: string; icon: GameIcon; matches: readonly string[] }[] = [
  { to: "/", word: WORDS.play, icon: Play, matches: ["/", "/blitz"] },
  { to: "/season", word: WORDS.season, icon: Trophy, matches: ["/season", "/p/"] },
  {
    to: "/profile",
    word: WORDS.you,
    icon: User,
    matches: ["/profile", "/results", "/scroll", "/terms", "/privacy", "/credits"],
  },
];

const YOU_TAB = TABS[2];

/** The places' addresses in order: the desktop's keys 1–3 open them. */
export const PLACES = TABS.map((tab) => tab.to);

const matchesPath = (pathname: string, match: string) =>
  match === "/" ? pathname === "/" : pathname.startsWith(match);

const useActiveTab = (): string | undefined => {
  const { pathname } = useLocation();
  return TABS.find((tab) => tab.matches.some((match) => matchesPath(pathname, match)))?.to;
};

/** You's icon is the player's portrait once signed in. */
const useSignedInPortrait = (): string | undefined => {
  const { session } = useIdentitySession();
  const address = useAccountStore((state) => state.account?.address);
  return session ? playerPortraitUrl(address, session.user.image) : undefined;
};

/** A place's mark: its icon, or on You the signed-in player's portrait. */
const TabIcon = ({ tab, current, size }: { tab: (typeof TABS)[number]; current: boolean; size: number }) => {
  const portrait = useSignedInPortrait();
  if (tab === YOU_TAB && portrait)
    return (
      <img
        src={portrait}
        alt=""
        style={{ width: size, height: size }}
        className={cn("rounded-full border-2 object-cover", current ? "border-kit-peach" : "border-kit-line2")}
      />
    );
  const Icon = tab.icon;
  return <Icon size={size} className={current ? undefined : "brightness-[.8] grayscale-[.6]"} />;
};

/** The phone's foot: the three places in thumb reach. */
export const TabBar = () => {
  const active = useActiveTab();
  return (
    <nav
      aria-label="Tabs"
      className="flex h-[calc(64px+env(safe-area-inset-bottom))] border-t border-kit-line bg-kit-ground px-2.5 pb-[env(safe-area-inset-bottom)]"
    >
      {TABS.map((tab) => {
        const current = active === tab.to;
        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            data-role="tab"
            aria-current={current ? "page" : undefined}
            className={cn(
              "flex min-h-12 flex-1 flex-col items-center justify-center gap-[3px] font-body text-sm font-semibold",
              current ? "text-kit-peach" : "text-kit-muted",
            )}
          >
            <TabIcon tab={tab} current={current} size={28} />
            {tab.word}
          </NavLink>
        );
      })}
    </nav>
  );
};

/**
 * The desktop's rail, the full height of the window: the lockup as the app's mark (Play, the first place, sits right
 * under it), then the three places with their keys; a full-screen step keeps the lockup alone.
 */
export const Rail = ({ places }: { places: boolean }) => {
  const active = useActiveTab();
  return (
    <header
      data-band="rail"
      className="sticky top-0 z-30 flex h-screen w-24 shrink-0 flex-col items-center gap-1 leather border-r pb-5 pt-5 min-[1800px]:w-28"
    >
      <div data-role="lockup" className="mb-6 flex flex-col items-center gap-2">
        <img src="/images/logos/realms-lockup-stacked.svg" alt="Realms" className="block w-16" />
        <EnvChip />
      </div>
      {places && (
        <nav aria-label="Tabs" className="flex w-full flex-col gap-1">
          {TABS.map((tab, index) => {
            const current = active === tab.to;
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                data-role="tab"
                aria-current={current ? "page" : undefined}
                className={cn(
                  "relative flex w-full flex-col items-center gap-1.5 py-3.5 font-body text-sm transition-colors",
                  current
                    ? "bg-gradient-to-r from-kit-gold/[.18] to-transparent text-kit-cream before:absolute before:inset-y-2.5 before:left-0 before:w-1 before:rounded-r before:bg-kit-gold"
                    : "text-kit-muted hover:bg-kit-gold/[.05] hover:text-kit-cream",
                )}
              >
                <TabIcon tab={tab} current={current} size={30} />
                {tab.word}
                <Kbd keyName={String(index + 1)} className="absolute right-2 top-2" />
              </NavLink>
            );
          })}
        </nav>
      )}
    </header>
  );
};
