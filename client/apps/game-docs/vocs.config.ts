import path from "path";
import { defineConfig } from "vocs";
import llmTxtPlugin from "./vite-plugin-llm-txt.mjs";

export default defineConfig({
  vite: {
    publicDir: path.resolve(__dirname, "../../public"),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./docs"),
        "@config": path.resolve(__dirname, "../../../config/utils/utils"),
        "@contracts": path.resolve(__dirname, "../../../contracts/utils"),
      },
    },
    plugins: [llmTxtPlugin()],
  },

  description: "Your Complete Guide to Mastering Eternum",
  iconUrl: "/images/logos/eternum-new.svg",
  logoUrl: "/images/logos/eternum-new.svg",
  ogImageUrl: "https://eternum-docs.realms.world/images/covers/og-image.png?4362984378",
  theme: {
    colorScheme: "dark",
    variables: {
      color: {
        textAccent: "#f6c297",
        background: "#14100d",
        backgroundDark: "#14100d",
        noteBackground: "#14100d",
      },
    },
  },
  font: {
    google: "Open Sans",
  },

  title: "Eternum",
  sidebar: [
    {
      text: "Overview",
      items: [
        { text: "Introduction", link: "/overview/introduction" },
        { text: "Key Concepts", link: "/mechanics/key-concepts" },
        { text: "Game Entry", link: "/overview/entry" },
        { text: "Cartridge Controller", link: "/overview/controller" },
        { text: "$LORDS Token", link: "/overview/lords" },
        { text: "Quick Links", link: "/overview/links" },
        { text: "Disclaimer - MUST READ", link: "/overview/disclaimer" },
        { text: "Resource Addresses", link: "/overview/resource-addresses" },
      ],
    },
    {
      text: "Game Mechanics",
      items: [
        { text: "World Physics", link: "/overview/world-physics" },
        {
          text: "Realms & Villages",
          link: "/mechanics/realm-and-villages/realm",
          collapsed: true,
          items: [
            { text: "Realms", link: "/mechanics/realm-and-villages/realm" },
            { text: "Villages", link: "/mechanics/realm-and-villages/villages" },
            { text: "Buildings", link: "/mechanics/realm-and-villages/buildings" },
            { text: "Wonders", link: "/mechanics/realm-and-villages/wonders" },
          ],
        },
        {
          text: "Materials",
          link: "/mechanics/resources/resources",
          collapsed: true,
          items: [
            { text: "Production", link: "/mechanics/resources/production" },
            { text: "Storage", link: "/mechanics/resources/storage" },
            { text: "Transfers & Trade", link: "/mechanics/resources/transfers-and-trade" },
            { text: "Bridging", link: "/mechanics/resources/bridging" },
          ],
        },
        {
          text: "Military",
          link: "/mechanics/military/armies",
          collapsed: true,
          items: [
            { text: "Armies", link: "/mechanics/military/armies" },
            { text: "Troop Tiers", link: "/mechanics/military/troop-tiers" },
            { text: "Stamina & Biomes", link: "/mechanics/military/stamina-and-biomes" },
            { text: "Damage", link: "/mechanics/military/damage" },
            { text: "Raiding", link: "/mechanics/military/raiding" },
          ],
        },
        {
          text: "World Map & Movement",
          link: "/mechanics/worldmap-movement/worldmap",
          collapsed: true,
          items: [
            { text: "World Map", link: "/mechanics/worldmap-movement/worldmap" },
            { text: "Movement & Exploration", link: "/mechanics/worldmap-movement/movement" },
          ],
        },
        {
          text: "World Structures",
          link: "/mechanics/world-structures",
        },
        {
          text: "Victory",
          link: "/mechanics/victory",
        },
        { text: "Prize Pool", link: "/mechanics/prize-pool" },
        { text: "Achievements", link: "/mechanics/achievements" },
        { text: "Tribes", link: "/mechanics/tribes" },
        { text: "Agents", link: "/mechanics/agents" },
      ],
    },
    {
      text: "Development",
      link: "/development",
      collapsed: true,
      items: [
        { text: "Getting Started", link: "/development/getting-started" },
        { text: "Client", link: "/development/client" },
        { text: "Contracts", link: "/development/contracts" },
        { text: "SDK", link: "/development/sdk" },
        { text: "Collaborators", link: "/development/collaborators" },
        { text: "LLM", link: "/development/llm" },
      ],
    },
  ],
});
