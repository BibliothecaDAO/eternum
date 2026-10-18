import { WORDS } from "@/ui/design-system/kit/words";
import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { type IconMeaning } from "@/ui/design-system/icon";
import type { ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";

import { useIdentitySession } from "@/hooks/context/identity-session";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { playerPortraitUrl } from "@/services/identity/player-portrait";

import { cn } from "@/ui/design-system/atoms/lib/utils";

import { AppTopBar } from "@/ui/design-system/kit/app-elements";
import { Portrait } from "@/ui/design-system/kit/portrait";
import { Lockup } from "./lockup";

/**
 * The app's three places, one list for both layouts: the phone's tab bar and the desktop's top bar. Play holds what to do
 * now, Season where the player stands, You the player, their finished games and everything about the account.
 */
const TABS: readonly { to: string; word: string; icon: IconMeaning; matches: readonly string[] }[] = [
  { to: "/", word: WORDS.play, icon: "play" as const, matches: ["/", "/blitz"] },
  { to: "/season", word: WORDS.season, icon: "leaderboard" as const, matches: ["/season", "/p/"] },
  {
    to: "/profile",
    word: WORDS.you,
    icon: "person" as const,
    matches: ["/profile", "/results", "/scroll", "/terms", "/privacy", "/credits"],
  },
];

const YOU_TAB = TABS[2];

const matchesPath = (pathname: string, match: string) =>
  match === "/" ? pathname === "/" : pathname.startsWith(match);

const useActiveTab = (): string | undefined => {
  const { pathname } = useLocation();
  return TABS.find((tab) => tab.matches.some((match) => matchesPath(pathname, match)))?.to;
};

/**
 * The signed-in player as the places show them: their name, and their portrait (their chosen one, else their
 * account's) where one can be drawn.
 */
const useSignedInPlayer = ():
  | { account: string | undefined; portrait: string | null | undefined; url: string; name: string }
  | undefined => {
  const { session } = useIdentitySession();
  const account = useAccountStore((state) => state.account?.address);
  const url = session ? playerPortraitUrl(account, session.user.image) : undefined;
  return session && url !== undefined
    ? { account, portrait: session.user.image, url, name: session.user.name || WORDS.you }
    : undefined;
};

/** A place's mark: its icon, or on You the signed-in player's portrait. */
const TabIcon = ({ tab, current, size }: { tab: (typeof TABS)[number]; current: boolean; size: number }) => {
  const portrait = useSignedInPlayer();
  if (tab === YOU_TAB && portrait)
    return (
      <Portrait
        account={portrait.account}
        portrait={portrait.portrait}
        size={size}
        weight={2}
        ring={current ? "lit" : "line"}
      />
    );
  const Icon = tab.icon;
  return <SemanticIcon name={Icon} size={size} className={current ? undefined : "brightness-[.8] grayscale-[.6]"} />;
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
              "flex min-h-12 flex-1 flex-col items-center justify-center gap-[3px] font-ui text-sm font-semibold",
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
 * The desktop's bar (the app sheet's AppTopBar): the lockup as the app's mark, then Play and Season with their icons, the
 * page's notice if it has one, and the player at the bar's far end (their name and portrait once signed in, else You).
 * It stays quiet (no gold fill) so the page's one gold step keeps the weight; a full-screen step keeps the lockup and
 * the notice alone.
 */
export const DesktopBar = ({ places, notice }: { places: boolean; notice: ReactNode }) => {
  const active = useActiveTab();
  const player = useSignedInPlayer();
  const placeOf = (tab: (typeof TABS)[number]) => ({
    to: tab.to,
    label: tab.word,
    icon: tab.icon,
    current: active === tab.to,
  });
  return (
    <AppTopBar
      mark={<Lockup />}
      places={places ? TABS.filter((tab) => tab !== YOU_TAB).map(placeOf) : []}
      player={places ? { ...placeOf(YOU_TAB), ...(player && { label: player.name, portrait: player.url }) } : null}
      notice={notice}
    />
  );
};
