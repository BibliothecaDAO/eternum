import { defineConfig } from "vocs";

export default defineConfig({
  title: "Eternum",
  sidebar: [
    {
      text: "Overview",
      items: [
        { text: "Welcome", link: "/overview/overview" },
        { text: "Introduction", link: "/overview/introduction" },
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
        { text: "Hyperstructures", link: "/mechanics/hyperstructures" },
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
      ],
    },
  ],
});
