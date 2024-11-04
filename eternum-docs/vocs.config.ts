import { defineConfig } from "vocs";

export default defineConfig({
  title: "Eternum",
  sidebar: [
    {
      text: "Game",
      link: "/game",
      collapsed: true,
      items: [
        { text: "Banking", link: "/game/banking" },
        { text: "Hyperstructures", link: "/game/hyperstructures" },
        { text: "Hexception", link: "/game/land-hexagons" },
        { text: "Resources", link: "/game/resources" },
        { text: "Realms", link: "/game/realms" },
        { text: "World Map", link: "/game/world-map-hex" },
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
