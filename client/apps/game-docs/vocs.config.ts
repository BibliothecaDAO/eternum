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
  ogImageUrl: "/images/covers/01.png",
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
        { text: "World Physics", link: "/overview/world-physics" },
        { text: "Game Entry", link: "/overview/entry" },
        { text: "Cartridge Controller", link: "/overview/controller" },
        { text: "Quick Links", link: "/overview/links" },
        { text: "Disclaimer - MUST READ", link: "/overview/disclaimer" },
        { text: "Bridge Closure - MUST READ", link: "/overview/bridging" },
        { text: "Resource Addresses", link: "/overview/resource-addresses" },
      ],
    },
    {
      text: "Game Mechanics",
      items: [
        { text: "Key Concepts", link: "/mechanics/key-concepts" },
        {
          text: "Realm and Villages",
          link: "/mechanics/realm-and-villages/realm",
          collapsed: true,
          items: [
            { text: "Realm", link: "/mechanics/realm-and-villages/realm" },
            { text: "Villages", link: "/mechanics/realm-and-villages/villages" },
            { text: "Buildings", link: "/mechanics/realm-and-villages/buildings" },
            { text: "Wonders", link: "/mechanics/realm-and-villages/wonders" },
          ],
        },
        {
          text: "Resources",
          link: "/mechanics/resources/resources",
          collapsed: true,
          items: [
            // { text: "Resources", link: "/mechanics/resources/resources" },
            { text: "Production", link: "/mechanics/resources/production" },
            { text: "Storage", link: "/mechanics/resources/storage" },
            { text: "Transfers & Trade", link: "/mechanics/resources/transfers-and-trade" },
          ],
        },
        {
          text: "Military",
          link: "/mechanics/military/combat",
          collapsed: true,
          items: [
            { text: "Combat", link: "/mechanics/military/combat" },
            { text: "Raiding", link: "/mechanics/military/raiding" },
          ],
        },
        { text: "World Map & Movement", link: "/mechanics/worldmap-and-movement" },
        {
          text: "World Structures",
          link: "/mechanics/world-structures/world-structures",
          collapsed: true,
          items: [{ text: "Hyperstructures", link: "/mechanics/world-structures/hyperstructures" }],
        },
        { text: "Victory", link: "/mechanics/victory" },
        { text: "Tribes", link: "/mechanics/tribes" },
        { text: "Achievements", link: "/mechanics/achievements" },
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
      ],
    },
  ],
});
