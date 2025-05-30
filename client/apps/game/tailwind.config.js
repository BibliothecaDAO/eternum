const plugin = require("tailwindcss/plugin");

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      textShadow: {
        "glow-yellow-xs": "0 0 5px rgba(250, 204, 21, 0.7)", // yellow-400 with 70% opacity
        "glow-brilliance-xs": "0 0 5px rgba(125, 255, 186, 0.7)", // brilliance (#7DFFBA) with 70% opacity
      },
      typography: ({ theme }) => ({
        pink: {
          css: {
            "--tw-prose-body": theme("colors.gold"),
            "--tw-prose-headings": theme("colors.gold"),
            "--tw-prose-lead": theme("colors.pink[700]"),
            "--tw-prose-links": theme("colors.crimson"),
            "--tw-prose-bold": theme("colors.gold"),
            "--tw-prose-counters": theme("colors.pink[600]"),
            "--tw-prose-bullets": theme("colors.pink[400]"),
            "--tw-prose-hr": theme("colors.pink[300]"),
            "--tw-prose-quotes": theme("colors.pink[900]"),
            "--tw-prose-quote-borders": theme("colors.pink[300]"),
            "--tw-prose-captions": theme("colors.pink[700]"),
            "--tw-prose-code": theme("colors.pink[900]"),
            "--tw-prose-pre-code": theme("colors.pink[100]"),
            "--tw-prose-pre-bg": theme("colors.pink[900]"),
            "--tw-prose-th-borders": theme("colors.pink[300]"),
            "--tw-prose-td-borders": theme("colors.pink[200]"),
            "--tw-prose-invert-body": theme("colors.pink[200]"),
            "--tw-prose-invert-headings": theme("colors.white"),
            "--tw-prose-invert-lead": theme("colors.pink[300]"),
            "--tw-prose-invert-links": theme("colors.white"),
            "--tw-prose-invert-bold": theme("colors.white"),
            "--tw-prose-invert-counters": theme("colors.pink[400]"),
            "--tw-prose-invert-bullets": theme("colors.pink[600]"),
            "--tw-prose-invert-hr": theme("colors.pink[700]"),
            "--tw-prose-invert-quotes": theme("colors.pink[100]"),
            "--tw-prose-invert-quote-borders": theme("colors.pink[700]"),
            "--tw-prose-invert-captions": theme("colors.pink[400]"),
            "--tw-prose-invert-code": theme("colors.white"),
            "--tw-prose-invert-pre-code": theme("colors.pink[300]"),
            "--tw-prose-invert-pre-bg": "rgb(0 0 0 / 50%)",
            "--tw-prose-invert-th-borders": theme("colors.pink[600]"),
            "--tw-prose-invert-td-borders": theme("colors.pink[700]"),
          },
        },
      }),
      colors: {
        gold: "#dfaa54",
        crimson: "#582C4D",
        brilliance: "#7DFFBA",
        orange: "#FE993C",
        yellow: "#FAFF00",
        red: "#FC4C4C",
        blueish: "#6B7FD7",
        "anger-light": "#CD8290",
        "gray-gold": "#776756",
        "light-pink": "#CAB1A6",
        gray: "#1B1B1B",
        "light-brown": "#14110B",
        brown: "#14100D",
        "light-red": "#EF5858",
        dark: "#010101",
        "dark-brown": "#0C0A08",
        danger: "#C84444",
        "dark-green": "#064105",
        "dark-green-accent": "#3A3D23",
        green: "#B5BD75",
        lightest: "#FFF5EA",
        ally: "#2B2E3E",
        cta: "#FFA200",
        enemy: "#46201D", // New color for enemies
        order: {
          power: "#F4B547",
          giants: "#EB544D",
          titans: "#EC68A8",
          skill: "#706DFF",
          perfection: "#8E35FF",
          twins: "#0020C6",
          reflection: "#00A2AA",
          detection: "#139757",
          fox: "#D47230",
          vitriol: "#59A509",
          brilliance: "#7DFFBA",
          enlightenment: "#1380FF",
          protection: "#00C3A1",
          fury: "#82005E",
          rage: "#C74800",
          anger: "#89192D",
          gods: "#94a3b8",
        },
        biome: {
          deep_ocean: "#3a5f65",
          ocean: "#62a68f",
          beach: "#ffe079",
          scorched: "#8B4513",
          bare: "#A8A8A8",
          tundra: "#B4C7D9",
          snow: "#FFFFFF",
          temperate_desert: "#f3c959",
          shrubland: "#b3ab3e",
          taiga: "#615b27",
          grassland: "#6b8228",
          temperate_deciduous_forest: "#57641f",
          temperate_rain_forest: "#5a6322",
          subtropical_desert: "#b2ac3a",
          tropical_seasonal_forest: "#596823",
          tropical_rain_forest: "#4f6123",
        },
      },
      backgroundImage: {
        map: "url(/images/map.svg)",
        "old-map": "url(public/textures/paper/worldmap-bg.png)",
        "dark-wood": "url(/images/textures/dark-wood.png)",
      },
      fontSize: {
        xs: ".975rem",
        xxs: ".825rem",
      },
      cursor: {
        fancy: "url(/images/icons/cursor.png), pointer",
        pointer: "url(/images/icons/cursor.png), pointer",
        grab: "url(public/images/icons/grab.png), grab",
        crosshair: "url(public/images/icons/cursor-cross.png), crosshair",
        wait: "url(public/images/logos/eternum-animated.png), wait",
      },
      strokeWidth: {
        8: "8px",
      },
      animation: {
        slowPulse: "slowPulse 2s ease-in-out infinite",
      },
      keyframes: {
        slowPulse: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.8" },
        },
      },
    },
  },
  safelist: [
    "bg-order-power",
    "bg-order-giants",
    "bg-order-titans",
    "bg-order-brilliance",
    "bg-order-skill",
    "bg-order-perfection",
    "bg-order-twins",
    "bg-order-reflection",
    "bg-order-detection",
    "bg-order-fox",
    "bg-order-vitriol",
    "bg-order-enlightenment",
    "bg-order-protection",
    "bg-order-fury",
    "bg-order-rage",
    "bg-order-anger",
    "bg-order-gods",
    "fill-order-power",
    "fill-order-giants",
    "fill-order-titans",
    "fill-order-brilliance",
    "fill-order-skill",
    "fill-order-perfection",
    "fill-order-twins",
    "fill-order-reflection",
    "fill-order-detection",
    "fill-order-fox",
    "fill-order-vitriol",
    "fill-order-enlightenment",
    "fill-order-protection",
    "fill-order-fury",
    "fill-order-rage",
    "fill-order-anger",
    "fill-order-gods",
    "stroke-order-power",
    "stroke-order-giants",
    "stroke-order-titans",
    "stroke-order-brilliance",
    "stroke-order-skill",
    "stroke-order-perfection",
    "stroke-order-twins",
    "stroke-order-reflection",
    "stroke-order-detection",
    "stroke-order-fox",
    "stroke-order-vitriol",
    "stroke-order-enlightenment",
    "stroke-order-protection",
    "stroke-order-fury",
    "stroke-order-rage",
    "stroke-order-anger",
    "stroke-order-gods",
    "text-order-power",
    "text-order-giants",
    "text-order-titans",
    "text-order-brilliance",
    "text-order-skill",
    "text-order-perfection",
    "text-order-twins",
    "text-order-reflection",
    "text-order-detection",
    "text-order-fox",
    "text-order-vitriol",
    "text-order-enlightenment",
    "text-order-protection",
    "text-order-fury",
    "text-order-rage",
    "text-order-anger",
    "text-order-gods",
    "text-biome-deep_ocean",
    "text-biome-ocean",
    "text-biome-beach",
    "text-biome-scorched",
    "text-biome-bare",
    "text-biome-tundra",
    "text-biome-snow",
    "text-biome-temperate_desert",
    "text-biome-shrubland",
    "text-biome-taiga",
    "text-biome-grassland",
    "text-biome-temperate_deciduous_forest",
    "text-biome-temperate_rain_forest",
    "text-biome-subtropical_desert",
    "text-biome-tropical_seasonal_forest",
    "text-biome-tropical_rain_forest",
    "text-ally",
    "text-enemy",
    "bg-ally",
    "bg-enemy",
  ],
  plugins: [
    require("@tailwindcss/typography"),
    plugin(function ({ addUtilities, theme, e }) {
      const textShadowUtilities = {
        ".text-shadow-glow-yellow-xs": {
          textShadow: theme("textShadow.glow-yellow-xs"),
        },
        ".text-shadow-glow-brilliance-xs": {
          textShadow: theme("textShadow.glow-brilliance-xs"),
        },
      };
      addUtilities(textShadowUtilities, ["responsive", "hover"]);

      const newUtilities = {
        ".border-gradient": {
          borderImage: "linear-gradient(to right, transparent, #F3C99F, transparent) 1",
        },
        ".clip-squared": {
          clipPath: "polygon(10% 0, 90% 0, 100% 10%, 100% 90%, 90% 100%, 10% 100%, 0 90%, 0 10%)",
        },
        ".clip-squared-top": {
          clipPath: "polygon(0 0, 100% 0, 100% 100%, 0 100%, 10% 10%)",
        },
        ".outline-gradient": {
          outline: "2px solid transparent",
          outlineOffset: "2px",
          borderImage: "linear-gradient(to right, transparent, #F3C99F, transparent) 1",
        },
        ".no-scrollbar": {
          /* IE and Edge */
          "-ms-overflow-style": "none",

          /* Firefox */
          "scrollbar-width": "none",

          /* Safari and Chrome */
          "&::-webkit-scrollbar": {
            display: "none",
          },
        },
      };
      addUtilities(newUtilities, ["responsive", "hover"]);
    }),
  ],
};
