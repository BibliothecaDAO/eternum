import { defineConfig } from "vocs";
import { docsAliases, publicDir } from "./docs/utils/paths";
import llmTxtPlugin from "./vite-plugin-llm-txt.mjs";
import BRAND from "./docs/brand.gen.json";

/** The brand's colours and marks, written from the game's token file (apps/game/src/brand/surfaces.ts). */
const color = BRAND.colors;
const alpha = (hex: string, opacity: number) =>
  `rgba(${[1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16)).join(", ")}, ${opacity})`;

/**
 * The site's paths on this machine, given to Vite by a plugin hook. Vocs ships its whole config in the site's bundle,
 * so a value that only means something on the building machine stays out of it: a hook ships as its source text
 * (scripts/vocs-config-boundary.test.mjs holds the shipped config to this). Only `vocs dev` serves the game's public
 * folder (the pages' images); a build copies none of it, and scripts/ship-referenced-assets.mjs ships what pages name.
 */
const docsPaths = {
  name: "docs-paths",
  config: (_config: unknown, { command }: { command: string }) => ({
    resolve: { alias: docsAliases },
    ...(command === "serve" ? { publicDir } : {}),
  }),
};

export default defineConfig({
  vite: {
    server: {
      allowedHosts: true,
    },
    plugins: [docsPaths, llmTxtPlugin()],
    css: {
      devSourcemap: true,
    },
  },

  description: "How to play Realms: Frontier and Blitz, your account, and LORDS",
  iconUrl: BRAND.marks.small,
  logoUrl: BRAND.marks.small,
  // The game serves the image; the docs build ships only files a page links by a relative path.
  ogImageUrl: "https://play.realms.party/images/covers/og-image.png",
  theme: {
    colorScheme: "dark",
    variables: {
      color: {
        background: color.ground,
        background2: color.plate,
        background3: color.plate,
        background4: color.plate2,
        background5: color.line,
        backgroundAccent: color.gold2,
        backgroundAccentHover: color.gold,
        backgroundAccentText: color.ink,
        backgroundDark: color.ground,
        border: alpha(color.gold2, 0.22),
        border2: alpha(color.gold2, 0.36),
        borderAccent: color.gold2,
        heading: color.cream,
        text: color.cream,
        text2: color.muted,
        text3: color.muted,
        text4: color.line2,
        textAccent: color.gold2,
        textAccentHover: color.gold,
        title: color.cream,
        noteBackground: alpha(color.ground, 0.92),
        noteBorder: alpha(color.gold2, 0.24),
        noteText: color.muted,
        codeBlockBackground: color.ground,
        codeInlineBackground: alpha(color.gold2, 0.09),
        codeInlineBorder: alpha(color.gold2, 0.22),
        codeInlineText: color.gold2,
        hr: alpha(color.gold2, 0.2),
        link: color.gold2,
        linkHover: color.gold,
        tableBorder: alpha(color.gold, 0.18),
        tableHeaderBackground: alpha(color.plate2, 0.92),
        tableHeaderText: color.gold,
      },
    },
  },
  title: "Realms Docs",
  sidebar: [
    {
      text: "Your account",
      items: [
        { text: "Sign in", link: "/account/sign-in" },
        { text: "Payout wallet", link: "/account/payout-wallet" },
        { text: "LORDS", link: "/account/lords" },
      ],
    },
    {
      text: "Frontier",
      items: [
        { text: "Frontier", link: "/frontier" },
        { text: "Your realm", link: "/frontier/realm" },
        { text: "Armies", link: "/frontier/armies" },
        { text: "The expedition", link: "/frontier/expedition" },
        { text: "Chests and LORDS", link: "/frontier/chests" },
      ],
    },
    {
      text: "Blitz",
      items: [
        { text: "Blitz", link: "/blitz" },
        { text: "Entry and the lobby", link: "/blitz/entry" },
        { text: "Realms and production", link: "/blitz/realms" },
        { text: "Transfers and donkeys", link: "/blitz/transport" },
        { text: "Armies and combat", link: "/blitz/armies" },
        { text: "The map", link: "/blitz/map" },
        { text: "Points, results and prizes", link: "/blitz/scoring" },
      ],
    },
    {
      text: "More",
      items: [
        { text: "What's new", link: "/changelog" },
        {
          text: "Developers",
          collapsed: true,
          items: [
            { text: "Getting started", link: "/development/getting-started" },
            { text: "Client", link: "/development/client" },
            { text: "Contracts", link: "/development/contracts" },
          ],
        },
        {
          text: "Eternum Season 1 (archive)",
          collapsed: true,
          items: [
            { text: "Key concepts", link: "/eternum/key-concepts" },
            { text: "Game entry", link: "/eternum/game-entry" },
            { text: "World physics", link: "/eternum/world-physics" },
            { text: "Realms", link: "/eternum/realm-and-villages/realm" },
            { text: "Villages", link: "/eternum/realm-and-villages/villages" },
            { text: "Buildings", link: "/eternum/realm-and-villages/buildings" },
            { text: "Wonders", link: "/eternum/realm-and-villages/wonders" },
            { text: "Materials", link: "/eternum/resources/resources" },
            { text: "Production", link: "/eternum/resources/production" },
            { text: "Automation", link: "/eternum/resources/automation" },
            { text: "Storage", link: "/eternum/resources/storage" },
            { text: "Transfers and trade", link: "/eternum/resources/transfers-and-trade" },
            { text: "Bridging", link: "/eternum/resources/bridging" },
            { text: "Armies", link: "/eternum/military/armies" },
            { text: "Troop tiers", link: "/eternum/military/troop-tiers" },
            { text: "Stamina and biomes", link: "/eternum/military/stamina-and-biomes" },
            { text: "Damage", link: "/eternum/military/damage" },
            { text: "Raiding", link: "/eternum/military/raiding" },
            { text: "The world map", link: "/eternum/worldmap-movement/worldmap" },
            { text: "Movement and exploration", link: "/eternum/worldmap-movement/movement" },
            { text: "World structures", link: "/eternum/world-structures" },
            { text: "Tribes", link: "/eternum/tribes" },
            { text: "Victory", link: "/eternum/victory" },
            { text: "Prize pool", link: "/eternum/prize-pool" },
            { text: "Achievements", link: "/eternum/achievements" },
          ],
        },
      ],
    },
  ],
});
