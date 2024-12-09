import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Link } from "@tanstack/react-router";
import { Castle, Gamepad2, Home, PlayCircle, Scale, Sheet, Ship } from "lucide-react";
import { TypeH2 } from "../typography/type-h2";

import { ReactComponent as EternumLogo } from "@/assets/icons/eternum_new_logo.svg";

// Menu items.
const items = [
  {
    title: "Home",
    url: "/",
    icon: Home,
  },
  {
    title: "Bridge",
    url: "/trade",
    icon: Ship,
  },
  // {
  //   title: "Bridge",
  //   url: "/bridge",
  //   icon: Ship,
  // },
  {
    title: "Realms",
    url: "/mint",
    icon: Castle,
  },
  {
    title: "Season Passes",
    url: "/season-passes",
    icon: Gamepad2,
  },
  {
    title: "Play",
    url: "https://eternum.realms.world/",
    icon: PlayCircle,
  },
  {
    title: "Marketplace",
    url: "https://market.realms.world/collection/0x057675b9c0bd62b096a2e15502a37b290fa766ead21c33eda42993e48a714b80",
    icon: Scale,
  },
  {
    title: "Documentation",
    url: "https://eternum-docs.realms.world/",
    icon: Sheet,
  },
];

export function AppSidebar() {
  return (
    <Sidebar>
      <SidebarContent>
        <div className="flex flex-col items-center">
          <EternumLogo className="w-24 h-24 fill-gold mx-auto pt-8" />
          <TypeH2 className="p-3">Eternum</TypeH2>
        </div>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    {item.url.startsWith("https") ? (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-secondary font-heading text-xl"
                      >
                        <item.icon />
                        <span>{item.title}</span>
                      </a>
                    ) : (
                      <Link className="[&.active]:font-bold [&.active]:bg-secondary font-heading text-xl" to={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
