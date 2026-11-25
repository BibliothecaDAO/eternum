import { CHAT_WORDS, COSMETICS_WORDS, WORDS } from "@/ui/design-system/kit/words";
import { useRealtimeChatSelector } from "@/ui/features/social";
import { chatUnread } from "@/ui/features/social/realtime-chat/model/direct-unread";
import { useAppChatPane, useChatOnPage } from "../chat/app-chat-place";
import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { type IconMeaning } from "@/ui/design-system/icon";
import type { ReactNode } from "react";

import { useIdentitySession } from "@/hooks/context/identity-session";
import { InstallButton } from "@/pwa/pwa-install-control";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { playerPortraitUrl } from "@/services/identity/player-portrait";

import { cn } from "@/ui/design-system/atoms/lib/utils";

import { AppLink, AppTopBar } from "@/ui/design-system/kit/app-elements";
import { Portrait } from "@/ui/design-system/kit/portrait";
import { Lockup } from "./lockup";
import { COSMETICS_PATH } from "../cosmetics/cosmetics-route";
import { PROFILE_PATH } from "../profile/settings-route";
import { FRAGMENTS_PATH } from "../shop/fragments-route";
import { useRequestSignIn } from "../sign-in/connect";
import { LordsBalancePill } from "../value/lords-balance-pill";
import { usePageAddress } from "./page-address";

type Place = { to: string; word: string; icon: IconMeaning; matches: readonly string[] };

export const WHATS_NEW_PATH = "/scroll";

const YOU_TAB: Place = {
  to: PROFILE_PATH,
  word: WORDS.you,
  icon: "person",
  matches: [PROFILE_PATH, "/results"],
};

const CHAT_TAB: Place = { to: "/chat", word: CHAT_WORDS.chat, icon: "chat", matches: ["/chat"] };

const PLAY_TAB: Place = { to: "/", word: WORDS.play, icon: "play", matches: ["/"] };
const SEASON_TAB: Place = { to: "/season", word: WORDS.season, icon: "leaderboard", matches: ["/season", "/p/"] };
const SHOP_TAB: Place = { to: FRAGMENTS_PATH, word: WORDS.shop, icon: "fragment", matches: [FRAGMENTS_PATH] };
const COSMETICS_TAB: Place = {
  to: COSMETICS_PATH,
  word: COSMETICS_WORDS.title,
  icon: "crown",
  matches: [COSMETICS_PATH],
};

export const TABS: readonly Place[] = [PLAY_TAB, SEASON_TAB, SHOP_TAB, CHAT_TAB, YOU_TAB];

const DESKTOP_PLACES: readonly Place[] = [PLAY_TAB, SEASON_TAB, COSMETICS_TAB, SHOP_TAB, CHAT_TAB];

const matchesPath = (pathname: string, match: string) =>
  match === "/" ? pathname === "/" : pathname.startsWith(match);

/**
 * While no one is signed in, You is Connect: pressed, it opens the Connect window over the page. It stands in You's
 * place, so it is the one lit on You's own pages.
 */
const useConnect = (): (() => void) | undefined => {
  const { session } = useIdentitySession();
  const requestSignIn = useRequestSignIn();
  return !session ? () => requestSignIn() : undefined;
};

/** Whether the page is one of the four places itself, which its phone head names by the lockup, not a title. */
export const useIsPlace = (): boolean => {
  const pathname = usePageAddress();
  return [...TABS, ...DESKTOP_PLACES].some((tab) => tab.to === pathname);
};

const useActiveTab = (places: readonly Place[]): string | undefined => {
  const pathname = usePageAddress();
  return places.find((tab) => tab.matches.some((match) => matchesPath(pathname, match)))?.to;
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

const PHONE_TAB =
  "flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-[2px] whitespace-nowrap font-ui text-xs font-semibold";

export const TabBar = () => {
  const active = useActiveTab(TABS);
  const connect = useConnect();
  const player = useSignedInPlayer();
  const unread = useRealtimeChatSelector(chatUnread);
  return (
    <nav
      aria-label="Tabs"
      className="flex h-[calc(64px+env(safe-area-inset-bottom))] border-t border-kit-line bg-kit-ground px-1 pb-[env(safe-area-inset-bottom)]"
    >
      {TABS.map((tab) => {
        const current = active === tab.to;
        const look = cn(PHONE_TAB, current ? "text-kit-peach" : "text-kit-muted");
        if (tab === YOU_TAB && connect)
          return (
            <button
              key={tab.to}
              type="button"
              data-role="tab"
              data-action="connect"
              aria-current={current ? "page" : undefined}
              onClick={connect}
              className={look}
            >
              <TabIcon tab={tab} current={current} size={26} />
              {WORDS.connect}
            </button>
          );
        return (
          <AppLink
            key={tab.to}
            to={tab.to}
            data-role="tab"
            data-player={(tab === YOU_TAB && player !== undefined) || undefined}
            aria-current={current ? "page" : undefined}
            className={look}
          >
            <span className="relative">
              <TabIcon tab={tab} current={current} size={26} />
              {tab === CHAT_TAB && unread > 0 && (
                <span
                  data-count
                  className="absolute -right-3 -top-1.5 min-w-5 rounded-full bg-kit-peach px-1 text-center text-xs leading-5 text-kit-ground"
                >
                  {unread}
                </span>
              )}
            </span>
            {tab.word}
          </AppLink>
        );
      })}
    </nav>
  );
};

export const TopBarEnd = () => (
  <span className="flex shrink-0 items-center gap-2 empty:hidden">
    <InstallButton />
    <LordsBalancePill />
  </span>
);

export const DesktopBar = ({ notice }: { notice: ReactNode }) => {
  const active = useActiveTab([...DESKTOP_PLACES, YOU_TAB]);
  const player = useSignedInPlayer();
  const connect = useConnect();
  const pane = useAppChatPane();
  const chatOnPage = useChatOnPage();
  const unread = useRealtimeChatSelector(chatUnread);
  const placeOf = (tab: Place) => ({
    to: tab.to,
    label: tab.word,
    icon: tab.icon,
    current: active === tab.to,
  });
  return (
    <AppTopBar
      mark={<Lockup />}
      places={DESKTOP_PLACES.map((tab) =>
        tab === CHAT_TAB && !chatOnPage
          ? { ...placeOf(tab), onSelect: pane.toggle, current: pane.open, count: unread }
          : placeOf(tab),
      )}
      end={<TopBarEnd />}
      player={{
        ...placeOf(YOU_TAB),
        ...(connect && { label: WORDS.connect, onSelect: connect, action: "connect" as const }),
        ...(player && { label: player.name, portrait: player.url, place: YOU_TAB.word }),
      }}
      notice={notice}
    />
  );
};
