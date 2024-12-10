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
import { Castle, Gamepad2, Home, PlayCircle, Scale, Sheet, Ship, Twitter } from "lucide-react";
import { TypeH2 } from "../typography/type-h2";

import { ReactComponent as Discord } from "@/assets/icons/discord.svg";
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
                        className="flex items-center gap-2 py-2 rounded-md hover:bg-secondary font-heading text-xl"
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
            {/* social links */}
            <div className="flex items-center gap-2 mt-8 justify-center">
              <a href="https://twitter.com/lootrealms" target="_blank" rel="noopener noreferrer">
                <Twitter />
              </a>
              <a href="https://discord.gg/realmsworld" target="_blank" rel="noopener noreferrer">
                <Discord className="w-6 h-6 fill-gold" />
              </a>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
