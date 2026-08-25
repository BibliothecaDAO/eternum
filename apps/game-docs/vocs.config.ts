import path from "path";
import { defineConfig } from "vocs";
import llmTxtPlugin from "./vite-plugin-llm-txt.mjs";

export default defineConfig({
  vite: {
    publicDir: path.resolve(__dirname, "../game/public"),
    server: {
      allowedHosts: true,
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./docs"),
        "@config": path.resolve(__dirname, "../../config/utils/utils"),
        "@contracts": path.resolve(__dirname, "../../contracts/utils"),
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
        href: "https://fonts.googleapis.com/css2?family=IM+Fell+English+SC&family=Cinzel:wght@400;600;700&family=MedievalSharp&family=Exo+2:wght@300;400;500;600;700&family=Rajdhani:wght@300;400;500;600;700&family=Source+Code+Pro:wght@400;500;600&display=swap",
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
  font: {
    google: "Exo 2",
  },

  title: "Realms Docs",
  sidebar: [
    {
      text: "Overview",
      items: [
        { text: "Introduction", link: "/overview/introduction" },
        { text: "Cartridge Controller", link: "/overview/controller" },
        { text: "$LORDS Token", link: "/overview/lords" },
        {
          text: "Loot Chests",
          collapsed: true,
          items: [
            { text: "Loot Chests", link: "/overview/chests/loot-chests" },
            { text: "Chest Contents", link: "/overview/chests/contents" },
            { text: "Cosmetic Items", link: "/overview/chests/cosmetics" },
          ],
        },
        { text: "Quick Links", link: "/overview/links" },
        { text: "Disclaimer - MUST READ", link: "/overview/disclaimer" },
        { text: "Resource Addresses", link: "/overview/resource-addresses" },
        { text: "The Agora (AMM)", link: "/overview/agora" },
      ],
    },
    {
      text: "Blitz",
      items: [
        { text: "Key Concepts", link: "/blitz/key-concepts" },
        { text: "Game Entry", link: "/blitz/game-entry" },
        { text: "World Physics", link: "/blitz/world-physics" },
        {
          text: "Realms",
          collapsed: true,
          items: [
            { text: "Realms", link: "/blitz/realms/realm" },
            { text: "Buildings", link: "/blitz/realms/buildings" },
          ],
        },
        {
          text: "Materials",
          collapsed: true,
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
      text: "Eternum (Season Ended)",
      items: [
        { text: "Key Concepts", link: "/eternum/key-concepts" },
        { text: "Game Entry", link: "/eternum/game-entry" },
        { text: "World Physics", link: "/eternum/world-physics" },
        {
          text: "Realms & Villages",
          collapsed: true,
          items: [
            { text: "Realms", link: "/eternum/realm-and-villages/realm" },
            { text: "Villages", link: "/eternum/realm-and-villages/villages" },
            { text: "Buildings", link: "/eternum/realm-and-villages/buildings" },
            { text: "Wonders", link: "/eternum/realm-and-villages/wonders" },
          ],
        },
        {
          text: "Materials",
          collapsed: true,
          items: [
            { text: "Materials", link: "/eternum/resources/resources" },
            { text: "Production", link: "/eternum/resources/production" },
            { text: "Automation", link: "/eternum/resources/automation" },
            { text: "Storage", link: "/eternum/resources/storage" },
            { text: "Transfers & Trade", link: "/eternum/resources/transfers-and-trade" },
            { text: "Bridging", link: "/eternum/resources/bridging" },
          ],
        },
        {
          text: "Military",
          collapsed: true,
          items: [
            { text: "Armies", link: "/eternum/military/armies" },
            { text: "Troop Tiers", link: "/eternum/military/troop-tiers" },
            { text: "Stamina & Biomes", link: "/eternum/military/stamina-and-biomes" },
            { text: "Damage", link: "/eternum/military/damage" },
            { text: "Raiding", link: "/eternum/military/raiding" },
          ],
        },
        {
          text: "World Map & Movement",
          collapsed: true,
          items: [
            { text: "The World Map", link: "/eternum/worldmap-movement/worldmap" },
            { text: "Movement & Exploration", link: "/eternum/worldmap-movement/movement" },
          ],
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
      items: [
        { text: "5 June 2026", link: "/changelog/5-june-2026" },
        { text: "28 March 2026", link: "/changelog/28-march-2026" },
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
