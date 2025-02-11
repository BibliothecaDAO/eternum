"use client";

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
  ExternalLink,
  Frame,
  Map,
  Newspaper,
  PieChart,
} from "lucide-react";

const data = {
  assets: [
    {
      title: "Realms",
      url: "/realms",
      icon: Banknote,

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
      url: "#",
      icon: BookOpen,
      items: [
        {
          title: "Beasts",
          url: "#",
        },
        {
          title: "Banners",
          url: "#",
        },
      ],
    },
  ],

  lords: [
    {
      title: "veLords (staking)",
      url: "/velords",
      icon: Banknote,

      items: [
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
      ],
    },
    {
      title: "Claims",
      url: "#",
      icon: BookOpen,
      items: [
        {
          title: "Realms Emissions",
          url: "/realms/claims",
        },
        {
          title: "Legacy Claims",
          url: "#",
        },
      ],
    },
  ],

  governance: [
    {
      title: "Delegation",
      url: "#",
      icon: Banknote,

      items: [
        {
          title: "Delegates List",
          url: "#",
        },
        {
          title: "Your Profile",
          url: "#",
        },
      ],
    },
    {
      title: "Proposals",
      url: "#",
      icon: BookOpen,
      items: [],
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
      url: "#",
      icon: Newspaper,
    },
  ],
  projects: [
    {
      name: "Design Engineering",
      url: "#",
      icon: Frame,
    },
    {
      name: "Sales & Marketing",
      url: "#",
      icon: PieChart,
    },
    {
      name: "Travel",
      url: "#",
      icon: Map,
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
