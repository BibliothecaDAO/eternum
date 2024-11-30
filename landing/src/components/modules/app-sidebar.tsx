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
import { Home, Ship } from "lucide-react";
import { TypeH2 } from "../typography/type-h2";

import { ReactComponent as EternumLogo } from "@/assets/icons/eternum_new_logo.svg";

// Menu items.
const items = [
  {
    title: "Home",
    url: "/",
    icon: Home,
  },
  // {
  //   title: "Passes",
  //   url: "/passes",
  //   icon: Inbox,
  // },
  // {
  //   title: "Trade",
  //   url: "/trade",
  //   icon: LoopIcon,
  // },
  // {
  //   title: "Bridge",
  //   url: "/bridge",
  //   icon: Ship,
  // },
  {
    title: "Season Passes",
    url: "/mint",
    icon: Ship,
  },
  // {
  //   title: "My Empire",
  //   url: "/my-empire",
  //   icon: Earth,
  // },
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
                    <Link className="[&.active]:font-bold [&.active]:bg-secondary font-heading text-xl" to={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
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
