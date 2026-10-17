import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { type IconMeaning } from "@/ui/design-system/icon";
import { Fragment, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";

import { useIdentitySession } from "@/hooks/context/identity-session";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { playerPortraitUrl } from "@/services/identity/player-portrait";

import { cn } from "@/ui/design-system/atoms/lib/utils";

import { WORDS } from "../words";
import { Kbd } from "@/ui/design-system/kit/kbd";
import { Portrait } from "@/ui/design-system/kit/portrait";
import { Lockup } from "./lockup";

/**
 * The app's three places, one list for both layouts: the phone's tab bar and the desktop's top bar. Play holds what to do
 * now, Season where the player stands, You the player, their finished games and everything about the account.
 */
const TABS: readonly { to: string; word: string; icon: IconMeaning; matches: readonly string[] }[] = [
  { to: "/", word: WORDS.play, icon: "play" as const, matches: ["/", "/blitz"] },
  { to: "/season", word: WORDS.season, icon: "victory" as const, matches: ["/season", "/p/"] },
  {
    to: "/profile",
    word: WORDS.you,
    icon: "person" as const,
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

/** You's icon is the player's portrait once signed in: their chosen one, else their account's. */
const useSignedInPortrait = (): { account: string | undefined; portrait: string | null | undefined } | undefined => {
  const { session } = useIdentitySession();
  const account = useAccountStore((state) => state.account?.address);
  return session && playerPortraitUrl(account, session.user.image) !== undefined
    ? { account, portrait: session.user.image }
    : undefined;
};

/** A place's mark: its icon, or on You the signed-in player's portrait. */
const TabIcon = ({ tab, current, size }: { tab: (typeof TABS)[number]; current: boolean; size: number }) => {
  const portrait = useSignedInPortrait();
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
 * The desktop's bar across the top of the window: the lockup as the app's mark, then Play and Season, the page's notice
 * if it has one (offline, an update, Install on Play), and You at the bar's far end, each place with its key. It stays
 * quiet (no gold fill) so the page's one gold step keeps the weight, and the notice in it pushes no content down; a
 * full-screen step keeps the lockup and the notice alone.
 */
export const TopBar = ({ places, notice }: { places: boolean; notice: ReactNode }) => {
  const active = useActiveTab();
  const noticeSlot = notice ? (
    <div data-band="notice" className="max-w-tabs">
      {notice}
    </div>
  ) : null;
  return (
    <header
      data-band="bar"
      className="sticky top-0 z-30 flex h-[68px] shrink-0 items-center gap-7 border-b border-kit-line bg-kit-ground/95 px-gutter-desk backdrop-blur wide:px-gutter-wide"
    >
      <div data-role="lockup">
        <Lockup />
      </div>
      {places ? (
        <nav aria-label="Tabs" className="flex flex-1 items-center gap-1.5">
          {TABS.map((tab, index) => {
            const current = active === tab.to;
            const link = (
              <NavLink
                key={tab.to}
                to={tab.to}
                data-role="tab"
                aria-current={current ? "page" : undefined}
                className={cn(
                  "flex h-12 items-center gap-2.5 rounded-control pl-3.5 pr-3 font-body text-base transition-colors",
                  current
                    ? "bg-kit-gold/[.14] text-kit-cream"
                    : "text-kit-muted hover:bg-kit-gold/[.06] hover:text-kit-cream",
                )}
              >
                <TabIcon tab={tab} current={current} size={24} />
                {tab.word}
                <Kbd keyName={String(index + 1)} className="ml-2" />
              </NavLink>
            );
            // You closes the bar, after the space and the notice.
            return tab === YOU_TAB ? (
              <Fragment key={tab.to}>
                <span className="flex-1" />
                {noticeSlot}
                {link}
              </Fragment>
            ) : (
              link
            );
          })}
        </nav>
      ) : (
        <>
          <span className="flex-1" />
          {noticeSlot}
        </>
      )}
    </header>
  );
};
