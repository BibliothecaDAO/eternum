import { REALMS_X_TAG, REALMS_X_URL } from "@realms-world/chain";
import { DOCS_ADDRESS } from "@/config/app-address";
import type { GameModeId } from "@/config/game-modes";
import type { IconMeaning } from "@/ui/design-system/icon";

/**
 * Where the realm talks, the same places in the same order as realms.world links them (apps/web/src/site/data/
 * socials.ts), each with its official mark.
 */
export const COMMUNITY = [
  { name: "X", href: REALMS_X_URL, icon: "brand-x" },
  { name: "Discord", href: "https://discord.gg/realmsworld", icon: "brand-discord" },
  { name: "Telegram", href: "https://t.me/+UpfCtj7qEO9hZjU1", icon: "brand-telegram" },
  { name: "CoinGecko", href: "https://www.coingecko.com/en/coins/lords", icon: "brand-coingecko" },
  { name: "GitHub", href: "https://github.com/BibliothecaDAO", icon: "brand-github" },
] as const satisfies readonly { name: string; href: string; icon: IconMeaning }[];

type Place = (typeof COMMUNITY)[number];

export const communityPlace = (name: Place["name"]): Place => COMMUNITY.find((place) => place.name === name)!;

/** The realm's X account as a post tags it. */
export const X_HANDLE = REALMS_X_TAG;

/**
 * Each game's guide: its section's first page on the docs site (apps/game-docs), the address a game's How to play opens
 * (owner, 4 November 2026: "we also need a docs link in the game"). Eternum's archive has no front page, so it opens its
 * first, Key concepts; Duel has no section, so it opens the site's front page. Keyed by the mode, so a new mode does not
 * compile without its guide; how-to-play.test.ts fails a guide that is not a page of the docs site.
 */
export const HOW_TO_PLAY_BY_MODE = {
  frontier: `${DOCS_ADDRESS}/frontier/`,
  blitz: `${DOCS_ADDRESS}/blitz/`,
  eternum: `${DOCS_ADDRESS}/eternum/key-concepts`,
  duel: `${DOCS_ADDRESS}/`,
} satisfies Record<GameModeId, string>;

/**
 * How to play outside a game: the Frontier guide, the rules a new player reads before their first season (owner, 29
 * October 2026: "the how to play link should go to frontier not blitz"). The site's front page only points at each game.
 */
export const HOW_TO_PLAY = HOW_TO_PLAY_BY_MODE.frontier;

/** Realms' marketplace: a site of its own, opened from You in a new tab. */
export const MARKET = "https://realms.market/";
