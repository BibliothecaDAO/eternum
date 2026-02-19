import path from "path";
import { defineConfig } from "vocs";
import llmTxtPlugin from "./vite-plugin-llm-txt.mjs";

export default defineConfig({
  vite: {
    publicDir: path.resolve(__dirname, "../../public"),
    server: {
      allowedHosts: true,
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./docs"),
        "@config": path.resolve(__dirname, "../../../config/utils/utils"),
        "@contracts": path.resolve(__dirname, "../../../contracts/utils"),
      },
    },
    plugins: [llmTxtPlugin()],
    css: {
      devSourcemap: true,
    },
  },

  description: "Your Complete Guide to Mastering Eternum",
  iconUrl: "/images/logos/eternum-new.svg",
  logoUrl: "/images/logos/eternum-new.svg",
  ogImageUrl: "https://docs.eternum.realms.world/images/covers/og-image.png?4362984380",
  head: {
    link: [
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=MedievalSharp&family=Exo+2:wght@300;400;500;600;700&family=Rajdhani:wght@300;400;500;600;700&family=Source+Code+Pro:wght@400;500;600&display=swap",
      },
      {
        rel: "stylesheet",
        href: "/styles.css",
      },
    ],
    script: [
      {
        children: `
(function () {
  function bindSidebarToggles() {
    const headers = document.querySelectorAll('.vocs_Sidebar_sectionHeader');
    headers.forEach((header) => {
      const chevron = header.querySelector('.vocs_Sidebar_sectionCollapse');
      const toggleBtn = header.querySelector('div[role="button"]');
      if (!chevron || !toggleBtn) return;

      header.addEventListener('click', (e) => {
        // If user clicked the chevron button itself, let Vocs handle it.
        if (e.target.closest('.vocs_Sidebar_sectionCollapse')) return;
        // Toggle instead of navigating for collapsible sections.
        e.preventDefault();
        toggleBtn.click();
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindSidebarToggles);
  } else {
    bindSidebarToggles();
  }
})();
        `.trim(),
      },
    ],
  },
  theme: {
    colorScheme: "dark",
    variables: {
      color: {
        textAccent: "#c9b06a",
        background: "#141520",
        backgroundDark: "#141520",
        noteBackground: "#1e2030",
      },
    },
  },
  font: {
    google: "Exo 2",
  },

  title: "Realms Docs",
  sidebar: [
    {
      text: "Overview",
      link: "/overview/introduction",
      items: [
        { text: "Introduction", link: "/overview/introduction" },
        { text: "Cartridge Controller", link: "/overview/controller" },
        { text: "$LORDS Token", link: "/overview/lords" },
        {
          text: "Loot Chests",
          collapsed: true,
          link: "/overview/chests/loot-chests",
          items: [
            { text: "Loot Chests", link: "/overview/chests/loot-chests" },
            { text: "Chest Contents", link: "/overview/chests/contents" },
            { text: "Cosmetic Items", link: "/overview/chests/cosmetics" },
          ],
        },
        { text: "Quick Links", link: "/overview/links" },
        { text: "Disclaimer - MUST READ", link: "/overview/disclaimer" },
        { text: "Resource Addresses", link: "/overview/resource-addresses" },
      ],
    },
    {
      text: "Blitz",
      link: "/blitz/key-concepts",
      items: [
        { text: "Key Concepts", link: "/blitz/key-concepts" },
        { text: "Game Entry", link: "/blitz/game-entry" },
        { text: "World Physics", link: "/blitz/world-physics" },
        {
          text: "Realms",
          collapsed: true,
          link: "/blitz/realms/realm",
          items: [
            { text: "Realms", link: "/blitz/realms/realm" },
            { text: "Buildings", link: "/blitz/realms/buildings" },
          ],
        },
        {
          text: "Materials",
          collapsed: true,
          link: "/blitz/materials/resources",
          items: [
            { text: "Materials", link: "/blitz/materials/resources" },
            { text: "Production", link: "/blitz/materials/production" },
            { text: "Production Automation", link: "/blitz/materials/automation" },
            { text: "Transfers & Trade", link: "/blitz/materials/transfers-and-trade" },
            { text: "Bridging", link: "/blitz/materials/bridging" },
            { text: "Relics", link: "/blitz/materials/relics" },
          ],
        },
        {
          text: "Military",
          collapsed: true,
          link: "/blitz/military/armies",
          items: [
            { text: "Armies", link: "/blitz/military/armies" },
            { text: "Troop Tiers", link: "/blitz/military/troop-tiers" },
            { text: "Stamina & Biomes", link: "/blitz/military/stamina-and-biomes" },
            { text: "Damage", link: "/blitz/military/damage" },
          ],
        },
        {
          text: "World Map & Movement",
          collapsed: true,
          link: "/blitz/worldmap-movement/worldmap",
          items: [
            { text: "The World Map", link: "/blitz/worldmap-movement/worldmap" },
            { text: "Movement & Exploration", link: "/blitz/worldmap-movement/movement" },
          ],
        },
        { text: "World Structures", link: "/blitz/world-structures" },
        { text: "Victory", link: "/blitz/victory" },
        { text: "Prize Pool", link: "/blitz/prize-pool" },
        { text: "MMR", link: "/blitz/mmr" },
        { text: "Achievements", link: "/blitz/achievements" },
      ],
    },
    {
      text: "Eternum (Season 1 - Concluded)",
      link: "/eternum/key-concepts",
      items: [
        { text: "Key Concepts", link: "/eternum/key-concepts" },
        { text: "Game Entry", link: "/eternum/game-entry" },
        { text: "World Physics", link: "/eternum/world-physics" },
        {
          text: "Realms & Villages",
          link: "/eternum/realm-and-villages/realm",
          collapsed: true,
          link: "/eternum/realm-and-villages/realm",
          items: [
            { text: "Villages", link: "/eternum/realm-and-villages/villages" },
            { text: "Buildings", link: "/eternum/realm-and-villages/buildings" },
            { text: "Wonders", link: "/eternum/realm-and-villages/wonders" },
          ],
        },
        {
          text: "Materials",
          link: "/eternum/resources/resources",
          collapsed: true,
          link: "/eternum/resources/resources",
          items: [
            { text: "Production", link: "/eternum/resources/production" },
            { text: "Automation", link: "/eternum/resources/automation" },
            { text: "Storage", link: "/eternum/resources/storage" },
            { text: "Transfers & Trade", link: "/eternum/resources/transfers-and-trade" },
            { text: "Bridging", link: "/eternum/resources/bridging" },
          ],
        },
        {
          text: "Military",
          link: "/eternum/military/armies",
          collapsed: true,
          link: "/eternum/military/armies",
          items: [
            { text: "Troop Tiers", link: "/eternum/military/troop-tiers" },
            { text: "Stamina & Biomes", link: "/eternum/military/stamina-and-biomes" },
            { text: "Damage", link: "/eternum/military/damage" },
            { text: "Raiding", link: "/eternum/military/raiding" },
          ],
        },
        {
          text: "World Map & Movement",
          link: "/eternum/worldmap-movement/worldmap",
          collapsed: true,
          link: "/eternum/worldmap-movement/worldmap",
          items: [{ text: "Movement & Exploration", link: "/eternum/worldmap-movement/movement" }],
        },
        { text: "World Structures", link: "/eternum/world-structures" },
        { text: "Tribes", link: "/eternum/tribes" },
        { text: "Victory", link: "/eternum/victory" },
        { text: "Prize Pool", link: "/eternum/prize-pool" },
      ],
    },
    {
      text: "Development",
      collapsed: true,
      link: "/development/getting-started",
      items: [
        { text: "Getting Started", link: "/development/getting-started" },
        { text: "Client", link: "/development/client" },
        { text: "Contracts", link: "/development/contracts" },
        { text: "SDK", link: "/development/sdk" },
        { text: "Collaborators", link: "/development/collaborators" },
        { text: "LLM", link: "/development/llm" },
      ],
    },
    {
      text: "Changelog",
      collapsed: true,
      link: "/changelog/18-february-2026",
      items: [
        { text: "18 February 2026", link: "/changelog/18-february-2026" },
        { text: "31 January 2026", link: "/changelog/31-january-2026" },
        { text: "8 December 2025", link: "/changelog/8-december-2025" },
        { text: "14 November 2025", link: "/changelog/14-november-2025" },
        { text: "7 November 2025", link: "/changelog/7-november-2025" },
        { text: "3 September 2025", link: "/changelog/3-september-2025" },
      ],
    },
  ],
});
