import path from "path";
import { defineConfig } from "vocs";

export default defineConfig({
  description: "Your Complete Guide to Mastering Eternum",
  iconUrl: "/eternum_new_logo.svg",
  logoUrl: "/eternum_new_logo.svg",
  ogImageUrl: "/eternum_documentation.png",
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
  vite: {
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./docs"),
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
        { text: "Game Entry", link: "/overview/entry" },
        { text: "Cartridge Controller", link: "/overview/controller" },
        { text: "Quick Links", link: "/overview/links" },
        { text: "Disclaimer - MUST READ", link: "/overview/disclaimer" },
      ],
    },
    {
      text: "Seasons",
      items: [
        { text: "Overview", link: "/seasons/overview" },
        { text: "Rewards", link: "/seasons/rewards" },
      ],
    },
    {
      text: "Game Mechanics",
      items: [
        { text: "Key Concepts", link: "/mechanics/key-concepts" },
        {
          text: "Realm Management",
          collapsed: true,
          items: [
            { text: "Realm", link: "/mechanics/realm/realm" },
            { text: "Buildings", link: "/mechanics/realm/buildings" },
            { text: "Wonders", link: "/mechanics/realm/wonders" },
          ],
        },
        {
          text: "Resources",
          collapsed: true,
          items: [
            { text: "Resources", link: "/mechanics/resources/resources" },
            { text: "Production", link: "/mechanics/resources/production" },
            { text: "Storage", link: "/mechanics/resources/storage" },
          ],
        },

        {
          text: "Military",
          collapsed: true,
          items: [
            { text: "Units", link: "/mechanics/military/units" },
            { text: "Combat", link: "/mechanics/military/combat" },
          ],
        },

        { text: "Trading", link: "/mechanics/trading" },
        { text: "World Map", link: "/mechanics/world-map" },
        { text: "Hyperstructures & Points", link: "/mechanics/hyperstructures" },
        { text: "Tribes", link: "/mechanics/tribes" },
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
        { text: "Common issues", link: "/development/common-issues" },
        { text: "Collaborators", link: "/development/collaborators" },
      ],
    },
  ],
});
