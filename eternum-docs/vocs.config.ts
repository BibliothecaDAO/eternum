import { defineConfig } from "vocs";

export default defineConfig({
  description: "Eternum Documentation",
  iconUrl: "/eternum_new_logo.svg",
  logoUrl: "/eternum_new_logo.svg",
  ogImageUrl:
    "https://og-image.preview.cartridge.gg/api/cartridge?logo=%https://www.dojoengine.org/dojo-icon.svg&title=%title&description=%description",

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
        { text: "Welcome", link: "/overview/overview" },
        { text: "Introduction", link: "/overview/introduction" },
        { text: "Entry", link: "/overview/entry" },
        { text: "Quick Links", link: "/overview/links" },
      ],
    },
    {
      text: "Game Mechanics",
      items: [
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
          text: "Realm management",
          collapsed: true,
          items: [
            { text: "Realm", link: "/mechanics/realm/realm" },
            { text: "Buildings", link: "/mechanics/realm/buildings" },
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
        { text: "Seasons", link: "/mechanics/seasons" },
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
      ],
    },
  ],
});
