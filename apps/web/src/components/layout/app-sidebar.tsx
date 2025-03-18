import * as React from "react";
import { NavMain } from "@/components/layout/nav-main";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";
import {
  Banknote,
  BookOpen,
  Castle,
  ClipboardPen,
  Earth,
  ExternalLink,
  HandCoins,
  Newspaper,
  Vote,
} from "lucide-react";

const data = {
  assets: [
    {
      title: "Realms",
      url: "/realms",
      icon: Castle,

      items: [
        {
          title: "Starknet Bridge",
          url: "/realms/bridge",
        },
        {
          title: "Claim Rewards",
          url: "/realms/claims",
        },
        {
          title: "Eternum Season Passes",
          target: "_blank",
          url: "https://empire.realms.world/season-passes",
        },
      ],
    },
    {
      title: "World",
      url: "/coming-soon",
      isActive: false,
      icon: Earth,
      items: [
        {
          title: "Beasts",
          url: "/coming-soon",
        },
        {
          title: "Banners",
          url: "/coming-soon",
        },
      ],
    },
  ],

  lords: [
    {
      title: "veLords (staking)",
      url: "/velords",
      icon: Banknote,

      /* items: [
        {
          title: "Staking",
          url: "#",
        },
        {
          title: "Claim Rewards",
          url: "#",
        },
        {
          title: "Statistics",
          url: "#",
        },
      ],*/
    },
    {
      title: "Claims",
      url: "/realms/claims",
      icon: HandCoins,
      items: [
        {
          title: "Realms Emissions",
          url: "/realms/claims",
        },
        /*{
          title: "Legacy Claims",
          url: "#",
        },*/
      ],
    },
  ],

  governance: [
    {
      title: "Delegation",
      url: "/delegate/list",
      icon: ClipboardPen,

      items: [
        {
          title: "Delegate List",
          url: "/delegate/list",
        },
        {
          title: "Your Profile",
          url: "/delegate/profile",
        },
      ],
    },
    {
      title: "Proposals",
      url: "/proposal/list",
      icon: Vote,
      items: [
        {
          title: "List",
          url: "/proposal/list",
        },
        {
          title: "Create",
          url: "/coming-soon",
        },
      ],
    },
  ],
  information: [
    {
      title: "Quick Links",
      url: "#",
      icon: ExternalLink,

      items: [
        {
          title: "CoinGecko",
          url: "https://www.coingecko.com/en/coins/lords",
        },
        {
          title: "Merch Shop",
          url: "https://shop.realms.world/",
        },
        {
          title: "Discord",
          url: "https://discord.com/invite/realmsworld",
        },
        {
          title: "Twitter",
          url: "https://x.com/lootrealms",
        },
        {
          title: "Github",
          url: "https://github.com/bibliothecaDAO",
        },
      ],
    },
    {
      title: "Documentation",
      url: "#",
      icon: BookOpen,
      items: [
        {
          title: "Realms.World",
          url: "#",
        },
        {
          title: "Eternum",
          url: "#",
        },
        {
          title: "Developer",
          url: "#",
        },
      ],
    },
    {
      title: "Blog",
      url: "https://realms.world/blog",
      icon: Newspaper,
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar
      collapsible="icon"
      {...props}
      className="top-(--header-height) h-[calc(100svh-var(--header-height))]!"
    >
      <SidebarHeader className="items-center"></SidebarHeader>
      <SidebarContent>
        <NavMain label="Game Assets" items={data.assets} />
        <NavMain label="Lords" items={data.lords} />
        <NavMain label="Governance" items={data.governance} />
        <NavMain label="Information" items={data.information} />
      </SidebarContent>
      <SidebarFooter>{/* <NavUser user={data.user} /> */}</SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
