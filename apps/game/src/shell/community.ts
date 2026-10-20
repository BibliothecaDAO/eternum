import type { IconMeaning } from "@/ui/design-system/icon";

/**
 * Where the realm talks, the same places in the same order as realms.world links them (apps/web/src/site/data/
 * socials.ts), each with its official mark.
 */
export const COMMUNITY = [
  { name: "X", href: "https://x.com/LootRealms", icon: "brand-x" },
  { name: "Discord", href: "https://discord.gg/realmsworld", icon: "brand-discord" },
  { name: "Telegram", href: "https://t.me/+UpfCtj7qEO9hZjU1", icon: "brand-telegram" },
  { name: "CoinGecko", href: "https://www.coingecko.com/en/coins/lords", icon: "brand-coingecko" },
  { name: "GitHub", href: "https://github.com/BibliothecaDAO", icon: "brand-github" },
] as const satisfies readonly { name: string; href: string; icon: IconMeaning }[];

type Place = (typeof COMMUNITY)[number];

export const communityPlace = (name: Place["name"]): Place => COMMUNITY.find((place) => place.name === name)!;

/** The realm's X account as a post tags it ("@LootRealms"), read from its one link above. */
export const X_HANDLE = `@${new URL(communityPlace("X").href).pathname.slice(1)}`;
