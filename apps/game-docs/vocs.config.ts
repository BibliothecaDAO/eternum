import { defineConfig } from "vocs";
import { docsAliases, publicDir } from "./docs/utils/paths";
import llmTxtPlugin from "./vite-plugin-llm-txt.mjs";

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
  iconUrl: "/images/logos/realms-mark.svg",
  logoUrl: "/images/logos/realms-lockup.svg",
  // The game serves the image; the docs build ships only files a page links by a relative path.
  ogImageUrl: "https://play.realms.party/images/covers/og-image.png",
  theme: {
    colorScheme: "dark",
    variables: {
      color: {
        background: "#050709",
        background2: "#070b0d",
        background3: "#101417",
        background4: "#161b20",
        background5: "#252417",
        backgroundAccent: "#e7cf88",
        backgroundAccentHover: "#f2dd9b",
        backgroundAccentText: "#17110a",
        backgroundDark: "#050709",
        border: "rgba(231, 207, 136, 0.22)",
        border2: "rgba(231, 207, 136, 0.36)",
        borderAccent: "#e7cf88",
        heading: "#f5ead0",
        text: "#e8dcc2",
        text2: "#cfc0a0",
        text3: "#a99570",
        text4: "#726754",
        textAccent: "#e7cf88",
        textAccentHover: "#f2dd9b",
        title: "#f5ead0",
        noteBackground: "rgba(7, 10, 12, 0.92)",
        noteBorder: "rgba(231, 207, 136, 0.24)",
        noteText: "#cfc0a0",
        codeBlockBackground: "#050709",
        codeInlineBackground: "rgba(231, 207, 136, 0.09)",
        codeInlineBorder: "rgba(231, 207, 136, 0.22)",
        codeInlineText: "#f2dd9b",
        hr: "rgba(231, 207, 136, 0.2)",
        link: "#e7cf88",
        linkHover: "#f2dd9b",
        tableBorder: "rgba(201, 169, 96, 0.18)",
        tableHeaderBackground: "rgba(22, 27, 32, 0.92)",
        tableHeaderText: "#c9a960",
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
