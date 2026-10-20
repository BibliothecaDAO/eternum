import { WORDS } from "@/ui/design-system/kit/words";
import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { type IconMeaning } from "@/ui/design-system/icon";
import type { ReactNode } from "react";

import { useIdentitySession } from "@/hooks/context/identity-session";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { playerPortraitUrl } from "@/services/identity/player-portrait";

import { cn } from "@/ui/design-system/atoms/lib/utils";

import { AppLink, AppTopBar } from "@/ui/design-system/kit/app-elements";
import { Portrait } from "@/ui/design-system/kit/portrait";
import { Lockup } from "./lockup";
import { usePageAddress } from "./page-address";

type Place = { to: string; word: string; icon: IconMeaning; matches: readonly string[] };

/** What's new's address, which realms.world links. */
export const WHATS_NEW_PATH = "/scroll";

/** You: the player's place, at the end of both bars. */
const YOU_TAB: Place = { to: "/profile", word: WORDS.you, icon: "person", matches: ["/profile", "/results"] };

/** Realms' marketplace: a site of its own, so it opens in a new tab and is never the current place. */
const MARKET_TAB: Place = { to: "https://market.realms.world/", word: WORDS.market, icon: "trade", matches: [] };

/**
 * The app's places, one list for both layouts: the phone's tab bar and the desktop's top bar. Play holds what to do
 * now, Season where the player stands, What's new the patch notes, Market
 * the trading of Realms' items on its own site, You the player, their finished games and everything about the account.
 * The legal pages, read from the footer, are none of these places: no tab is current there (qa-app-1 P3-3).
 */
const TABS: readonly Place[] = [
  { to: "/", word: WORDS.play, icon: "play", matches: ["/", "/blitz"] },
  { to: "/season", word: WORDS.season, icon: "leaderboard", matches: ["/season", "/p/"] },
  {
    to: WHATS_NEW_PATH,
    word: WORDS.whatsNew,
    icon: "chronicles",
    matches: [WHATS_NEW_PATH],
  },
  MARKET_TAB,
  YOU_TAB,
];

const matchesPath = (pathname: string, match: string) =>
  match === "/" ? pathname === "/" : pathname.startsWith(match);

const useActiveTab = (): string | undefined => {
  const pathname = usePageAddress();
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
const TabIcon = ({ tab, current, size }: { tab: Place; current: boolean; size: number }) => {
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

/** The phone's foot: the places in thumb reach, each as wide as its word and the rest shared, so no word wraps. */
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
          <AppLink
            key={tab.to}
            to={tab.to}
            data-role="tab"
            aria-current={current ? "page" : undefined}
            className={cn(
              "flex min-h-12 flex-auto flex-col items-center justify-center gap-[3px] whitespace-nowrap font-ui text-sm font-semibold",
              current ? "text-kit-peach" : "text-kit-muted",
            )}
          >
            <TabIcon tab={tab} current={current} size={28} />
            {tab.word}
          </AppLink>
        );
      })}
    </nav>
  );
};

/**
 * The desktop's bar (the app sheet's AppTopBar): the lockup as the app's mark, then Play, Season, What's new and Market
 * with their icons, the page's notice if it has one, and the player at the bar's far end (their name and portrait once
 * signed in, else You). It stays quiet (no gold fill) so the page's one gold step keeps the weight; a full-screen step
 * keeps the lockup and the notice alone.
 */
export const DesktopBar = ({ places, notice }: { places: boolean; notice: ReactNode }) => {
  const active = useActiveTab();
  const player = useSignedInPlayer();
  const placeOf = (tab: Place) => ({
    to: tab.to,
    label: tab.word,
    icon: tab.icon,
    current: active === tab.to,
  });
  return (
    <AppTopBar
      mark={<Lockup />}
      places={places ? TABS.filter((tab) => tab !== YOU_TAB).map(placeOf) : []}
      player={
        places
          ? { ...placeOf(YOU_TAB), ...(player && { label: player.name, portrait: player.url, place: YOU_TAB.word }) }
          : null
      }
      notice={notice}
    />
  );
};
