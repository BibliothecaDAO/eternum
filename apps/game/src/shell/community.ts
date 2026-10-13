/** Where the realm talks, the same four places realms.world links (apps/web/src/site/data/socials.ts). */
export const COMMUNITY = [
  {
    name: "Discord",
    href: "https://discord.gg/realmsworld",
  },
  {
    name: "X",
    href: "https://x.com/LootRealms",
  },
  {
    name: "Telegram",
    href: "https://t.me/+UpfCtj7qEO9hZjU1",
  },
  {
    name: "GitHub",
    href: "https://github.com/BibliothecaDAO",
  },
] as const;

type Place = (typeof COMMUNITY)[number];

export const communityPlace = (name: Place["name"]): Place => COMMUNITY.find((place) => place.name === name)!;
