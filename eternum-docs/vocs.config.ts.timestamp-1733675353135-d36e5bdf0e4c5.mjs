// vocs.config.ts
import { defineConfig } from "file:///Users/spaghetti/Documents/Eternum-Main/eternum/node_modules/.pnpm/vocs@1.0.0-alpha.62_@types+node@22.8.1_@types+react-dom@18.3.1_@types+react@18.3.12_acorn@8.1_bz32v3itzczfn7wkqhaodtiylq/node_modules/vocs/_lib/index.js";
var vocs_config_default = defineConfig({
  description: "Eternum Documentation",
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
        noteBackground: "#14100d"
      }
    }
  },
  font: {
    google: "Open Sans"
  },
  title: "Eternum",
  sidebar: [
    {
      text: "Overview",
      items: [
        // { text: "Welcome", link: "/overview/welcome" },
        { text: "Introduction", link: "/overview/introduction" },
        { text: "Game Entry", link: "/overview/entry" },
        { text: "Cartridge Controller", link: "/overview/controller" },
        { text: "Quick Links", link: "/overview/links" },
        { text: "Disclaimer - MUST READ", link: "/overview/disclaimer" }
      ]
    },
    {
      text: "Game Mechanics",
      items: [
        { text: "Key Concepts", link: "/mechanics/key-concepts" },
        {
          text: "Realm management",
          collapsed: true,
          items: [
            { text: "Realm", link: "/mechanics/realm/realm" },
            { text: "Buildings", link: "/mechanics/realm/buildings" },
            { text: "Wonders", link: "/mechanics/realm/wonders" }
          ]
        },
        {
          text: "Resources",
          collapsed: true,
          items: [
            { text: "Resources", link: "/mechanics/resources/resources" },
            { text: "Production", link: "/mechanics/resources/production" },
            { text: "Storage", link: "/mechanics/resources/storage" }
          ]
        },
        {
          text: "Military",
          collapsed: true,
          items: [
            { text: "Units", link: "/mechanics/military/units" },
            { text: "Combat", link: "/mechanics/military/combat" }
          ]
        },
        { text: "Trading", link: "/mechanics/trading" },
        { text: "World Map", link: "/mechanics/world-map" },
        { text: "Hyperstructures & Points", link: "/mechanics/hyperstructures" },
        { text: "Tribes", link: "/mechanics/tribes" }
      ]
    },
    {
      text: "Seasons",
      items: [
        { text: "Overview", link: "/seasons/overview" },
        { text: "Rewards", link: "/seasons/rewards" }
      ]
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
        { text: "Collaborators", link: "/development/collaborators" }
      ]
    }
  ]
});
export {
  vocs_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidm9jcy5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvVXNlcnMvc3BhZ2hldHRpL0RvY3VtZW50cy9FdGVybnVtLU1haW4vZXRlcm51bS9ldGVybnVtLWRvY3NcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9Vc2Vycy9zcGFnaGV0dGkvRG9jdW1lbnRzL0V0ZXJudW0tTWFpbi9ldGVybnVtL2V0ZXJudW0tZG9jcy92b2NzLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vVXNlcnMvc3BhZ2hldHRpL0RvY3VtZW50cy9FdGVybnVtLU1haW4vZXRlcm51bS9ldGVybnVtLWRvY3Mvdm9jcy5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidm9jc1wiO1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBkZXNjcmlwdGlvbjogXCJFdGVybnVtIERvY3VtZW50YXRpb25cIixcbiAgaWNvblVybDogXCIvZXRlcm51bV9uZXdfbG9nby5zdmdcIixcbiAgbG9nb1VybDogXCIvZXRlcm51bV9uZXdfbG9nby5zdmdcIixcbiAgb2dJbWFnZVVybDogXCIvZXRlcm51bV9kb2N1bWVudGF0aW9uLnBuZ1wiLFxuICB0aGVtZToge1xuICAgIGNvbG9yU2NoZW1lOiBcImRhcmtcIixcbiAgICB2YXJpYWJsZXM6IHtcbiAgICAgIGNvbG9yOiB7XG4gICAgICAgIHRleHRBY2NlbnQ6IFwiI2Y2YzI5N1wiLFxuICAgICAgICBiYWNrZ3JvdW5kOiBcIiMxNDEwMGRcIixcbiAgICAgICAgYmFja2dyb3VuZERhcms6IFwiIzE0MTAwZFwiLFxuICAgICAgICBub3RlQmFja2dyb3VuZDogXCIjMTQxMDBkXCIsXG4gICAgICB9LFxuICAgIH0sXG4gIH0sXG4gIGZvbnQ6IHtcbiAgICBnb29nbGU6IFwiT3BlbiBTYW5zXCIsXG4gIH0sXG4gIHRpdGxlOiBcIkV0ZXJudW1cIixcbiAgc2lkZWJhcjogW1xuICAgIHtcbiAgICAgIHRleHQ6IFwiT3ZlcnZpZXdcIixcbiAgICAgIGl0ZW1zOiBbXG4gICAgICAgIC8vIHsgdGV4dDogXCJXZWxjb21lXCIsIGxpbms6IFwiL292ZXJ2aWV3L3dlbGNvbWVcIiB9LFxuICAgICAgICB7IHRleHQ6IFwiSW50cm9kdWN0aW9uXCIsIGxpbms6IFwiL292ZXJ2aWV3L2ludHJvZHVjdGlvblwiIH0sXG4gICAgICAgIHsgdGV4dDogXCJHYW1lIEVudHJ5XCIsIGxpbms6IFwiL292ZXJ2aWV3L2VudHJ5XCIgfSxcbiAgICAgICAgeyB0ZXh0OiBcIkNhcnRyaWRnZSBDb250cm9sbGVyXCIsIGxpbms6IFwiL292ZXJ2aWV3L2NvbnRyb2xsZXJcIiB9LFxuICAgICAgICB7IHRleHQ6IFwiUXVpY2sgTGlua3NcIiwgbGluazogXCIvb3ZlcnZpZXcvbGlua3NcIiB9LFxuICAgICAgICB7IHRleHQ6IFwiRGlzY2xhaW1lciAtIE1VU1QgUkVBRFwiLCBsaW5rOiBcIi9vdmVydmlldy9kaXNjbGFpbWVyXCIgfSxcbiAgICAgIF0sXG4gICAgfSxcbiAgICB7XG4gICAgICB0ZXh0OiBcIkdhbWUgTWVjaGFuaWNzXCIsXG4gICAgICBpdGVtczogW1xuICAgICAgICB7IHRleHQ6IFwiS2V5IENvbmNlcHRzXCIsIGxpbms6IFwiL21lY2hhbmljcy9rZXktY29uY2VwdHNcIiB9LFxuICAgICAgICB7XG4gICAgICAgICAgdGV4dDogXCJSZWFsbSBtYW5hZ2VtZW50XCIsXG4gICAgICAgICAgY29sbGFwc2VkOiB0cnVlLFxuICAgICAgICAgIGl0ZW1zOiBbXG4gICAgICAgICAgICB7IHRleHQ6IFwiUmVhbG1cIiwgbGluazogXCIvbWVjaGFuaWNzL3JlYWxtL3JlYWxtXCIgfSxcbiAgICAgICAgICAgIHsgdGV4dDogXCJCdWlsZGluZ3NcIiwgbGluazogXCIvbWVjaGFuaWNzL3JlYWxtL2J1aWxkaW5nc1wiIH0sXG4gICAgICAgICAgICB7IHRleHQ6IFwiV29uZGVyc1wiLCBsaW5rOiBcIi9tZWNoYW5pY3MvcmVhbG0vd29uZGVyc1wiIH0sXG4gICAgICAgICAgXSxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIHRleHQ6IFwiUmVzb3VyY2VzXCIsXG4gICAgICAgICAgY29sbGFwc2VkOiB0cnVlLFxuICAgICAgICAgIGl0ZW1zOiBbXG4gICAgICAgICAgICB7IHRleHQ6IFwiUmVzb3VyY2VzXCIsIGxpbms6IFwiL21lY2hhbmljcy9yZXNvdXJjZXMvcmVzb3VyY2VzXCIgfSxcbiAgICAgICAgICAgIHsgdGV4dDogXCJQcm9kdWN0aW9uXCIsIGxpbms6IFwiL21lY2hhbmljcy9yZXNvdXJjZXMvcHJvZHVjdGlvblwiIH0sXG4gICAgICAgICAgICB7IHRleHQ6IFwiU3RvcmFnZVwiLCBsaW5rOiBcIi9tZWNoYW5pY3MvcmVzb3VyY2VzL3N0b3JhZ2VcIiB9LFxuICAgICAgICAgIF0sXG4gICAgICAgIH0sXG5cbiAgICAgICAge1xuICAgICAgICAgIHRleHQ6IFwiTWlsaXRhcnlcIixcbiAgICAgICAgICBjb2xsYXBzZWQ6IHRydWUsXG4gICAgICAgICAgaXRlbXM6IFtcbiAgICAgICAgICAgIHsgdGV4dDogXCJVbml0c1wiLCBsaW5rOiBcIi9tZWNoYW5pY3MvbWlsaXRhcnkvdW5pdHNcIiB9LFxuICAgICAgICAgICAgeyB0ZXh0OiBcIkNvbWJhdFwiLCBsaW5rOiBcIi9tZWNoYW5pY3MvbWlsaXRhcnkvY29tYmF0XCIgfSxcbiAgICAgICAgICBdLFxuICAgICAgICB9LFxuXG4gICAgICAgIHsgdGV4dDogXCJUcmFkaW5nXCIsIGxpbms6IFwiL21lY2hhbmljcy90cmFkaW5nXCIgfSxcbiAgICAgICAgeyB0ZXh0OiBcIldvcmxkIE1hcFwiLCBsaW5rOiBcIi9tZWNoYW5pY3Mvd29ybGQtbWFwXCIgfSxcbiAgICAgICAgeyB0ZXh0OiBcIkh5cGVyc3RydWN0dXJlcyAmIFBvaW50c1wiLCBsaW5rOiBcIi9tZWNoYW5pY3MvaHlwZXJzdHJ1Y3R1cmVzXCIgfSxcbiAgICAgICAgeyB0ZXh0OiBcIlRyaWJlc1wiLCBsaW5rOiBcIi9tZWNoYW5pY3MvdHJpYmVzXCIgfSxcbiAgICAgIF0sXG4gICAgfSxcbiAgICB7XG4gICAgICB0ZXh0OiBcIlNlYXNvbnNcIixcbiAgICAgIGl0ZW1zOiBbXG4gICAgICAgIHsgdGV4dDogXCJPdmVydmlld1wiLCBsaW5rOiBcIi9zZWFzb25zL292ZXJ2aWV3XCIgfSxcbiAgICAgICAgeyB0ZXh0OiBcIlJld2FyZHNcIiwgbGluazogXCIvc2Vhc29ucy9yZXdhcmRzXCIgfSxcbiAgICAgIF0sXG4gICAgfSxcblxuICAgIHtcbiAgICAgIHRleHQ6IFwiRGV2ZWxvcG1lbnRcIixcbiAgICAgIGxpbms6IFwiL2RldmVsb3BtZW50XCIsXG4gICAgICBjb2xsYXBzZWQ6IHRydWUsXG4gICAgICBpdGVtczogW1xuICAgICAgICB7IHRleHQ6IFwiR2V0dGluZyBTdGFydGVkXCIsIGxpbms6IFwiL2RldmVsb3BtZW50L2dldHRpbmctc3RhcnRlZFwiIH0sXG4gICAgICAgIHsgdGV4dDogXCJDbGllbnRcIiwgbGluazogXCIvZGV2ZWxvcG1lbnQvY2xpZW50XCIgfSxcbiAgICAgICAgeyB0ZXh0OiBcIkNvbnRyYWN0c1wiLCBsaW5rOiBcIi9kZXZlbG9wbWVudC9jb250cmFjdHNcIiB9LFxuICAgICAgICB7IHRleHQ6IFwiU0RLXCIsIGxpbms6IFwiL2RldmVsb3BtZW50L3Nka1wiIH0sXG4gICAgICAgIHsgdGV4dDogXCJDb21tb24gaXNzdWVzXCIsIGxpbms6IFwiL2RldmVsb3BtZW50L2NvbW1vbi1pc3N1ZXNcIiB9LFxuICAgICAgICB7IHRleHQ6IFwiQ29sbGFib3JhdG9yc1wiLCBsaW5rOiBcIi9kZXZlbG9wbWVudC9jb2xsYWJvcmF0b3JzXCIgfSxcbiAgICAgIF0sXG4gICAgfSxcbiAgXSxcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUFzVyxTQUFTLG9CQUFvQjtBQUVuWSxJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixhQUFhO0FBQUEsRUFDYixTQUFTO0FBQUEsRUFDVCxTQUFTO0FBQUEsRUFDVCxZQUFZO0FBQUEsRUFDWixPQUFPO0FBQUEsSUFDTCxhQUFhO0FBQUEsSUFDYixXQUFXO0FBQUEsTUFDVCxPQUFPO0FBQUEsUUFDTCxZQUFZO0FBQUEsUUFDWixZQUFZO0FBQUEsUUFDWixnQkFBZ0I7QUFBQSxRQUNoQixnQkFBZ0I7QUFBQSxNQUNsQjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQUEsRUFDQSxNQUFNO0FBQUEsSUFDSixRQUFRO0FBQUEsRUFDVjtBQUFBLEVBQ0EsT0FBTztBQUFBLEVBQ1AsU0FBUztBQUFBLElBQ1A7QUFBQSxNQUNFLE1BQU07QUFBQSxNQUNOLE9BQU87QUFBQTtBQUFBLFFBRUwsRUFBRSxNQUFNLGdCQUFnQixNQUFNLHlCQUF5QjtBQUFBLFFBQ3ZELEVBQUUsTUFBTSxjQUFjLE1BQU0sa0JBQWtCO0FBQUEsUUFDOUMsRUFBRSxNQUFNLHdCQUF3QixNQUFNLHVCQUF1QjtBQUFBLFFBQzdELEVBQUUsTUFBTSxlQUFlLE1BQU0sa0JBQWtCO0FBQUEsUUFDL0MsRUFBRSxNQUFNLDBCQUEwQixNQUFNLHVCQUF1QjtBQUFBLE1BQ2pFO0FBQUEsSUFDRjtBQUFBLElBQ0E7QUFBQSxNQUNFLE1BQU07QUFBQSxNQUNOLE9BQU87QUFBQSxRQUNMLEVBQUUsTUFBTSxnQkFBZ0IsTUFBTSwwQkFBMEI7QUFBQSxRQUN4RDtBQUFBLFVBQ0UsTUFBTTtBQUFBLFVBQ04sV0FBVztBQUFBLFVBQ1gsT0FBTztBQUFBLFlBQ0wsRUFBRSxNQUFNLFNBQVMsTUFBTSx5QkFBeUI7QUFBQSxZQUNoRCxFQUFFLE1BQU0sYUFBYSxNQUFNLDZCQUE2QjtBQUFBLFlBQ3hELEVBQUUsTUFBTSxXQUFXLE1BQU0sMkJBQTJCO0FBQUEsVUFDdEQ7QUFBQSxRQUNGO0FBQUEsUUFDQTtBQUFBLFVBQ0UsTUFBTTtBQUFBLFVBQ04sV0FBVztBQUFBLFVBQ1gsT0FBTztBQUFBLFlBQ0wsRUFBRSxNQUFNLGFBQWEsTUFBTSxpQ0FBaUM7QUFBQSxZQUM1RCxFQUFFLE1BQU0sY0FBYyxNQUFNLGtDQUFrQztBQUFBLFlBQzlELEVBQUUsTUFBTSxXQUFXLE1BQU0sK0JBQStCO0FBQUEsVUFDMUQ7QUFBQSxRQUNGO0FBQUEsUUFFQTtBQUFBLFVBQ0UsTUFBTTtBQUFBLFVBQ04sV0FBVztBQUFBLFVBQ1gsT0FBTztBQUFBLFlBQ0wsRUFBRSxNQUFNLFNBQVMsTUFBTSw0QkFBNEI7QUFBQSxZQUNuRCxFQUFFLE1BQU0sVUFBVSxNQUFNLDZCQUE2QjtBQUFBLFVBQ3ZEO0FBQUEsUUFDRjtBQUFBLFFBRUEsRUFBRSxNQUFNLFdBQVcsTUFBTSxxQkFBcUI7QUFBQSxRQUM5QyxFQUFFLE1BQU0sYUFBYSxNQUFNLHVCQUF1QjtBQUFBLFFBQ2xELEVBQUUsTUFBTSw0QkFBNEIsTUFBTSw2QkFBNkI7QUFBQSxRQUN2RSxFQUFFLE1BQU0sVUFBVSxNQUFNLG9CQUFvQjtBQUFBLE1BQzlDO0FBQUEsSUFDRjtBQUFBLElBQ0E7QUFBQSxNQUNFLE1BQU07QUFBQSxNQUNOLE9BQU87QUFBQSxRQUNMLEVBQUUsTUFBTSxZQUFZLE1BQU0sb0JBQW9CO0FBQUEsUUFDOUMsRUFBRSxNQUFNLFdBQVcsTUFBTSxtQkFBbUI7QUFBQSxNQUM5QztBQUFBLElBQ0Y7QUFBQSxJQUVBO0FBQUEsTUFDRSxNQUFNO0FBQUEsTUFDTixNQUFNO0FBQUEsTUFDTixXQUFXO0FBQUEsTUFDWCxPQUFPO0FBQUEsUUFDTCxFQUFFLE1BQU0sbUJBQW1CLE1BQU0sK0JBQStCO0FBQUEsUUFDaEUsRUFBRSxNQUFNLFVBQVUsTUFBTSxzQkFBc0I7QUFBQSxRQUM5QyxFQUFFLE1BQU0sYUFBYSxNQUFNLHlCQUF5QjtBQUFBLFFBQ3BELEVBQUUsTUFBTSxPQUFPLE1BQU0sbUJBQW1CO0FBQUEsUUFDeEMsRUFBRSxNQUFNLGlCQUFpQixNQUFNLDZCQUE2QjtBQUFBLFFBQzVELEVBQUUsTUFBTSxpQkFBaUIsTUFBTSw2QkFBNkI7QUFBQSxNQUM5RDtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
