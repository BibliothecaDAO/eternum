import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { LoopIcon } from "@radix-ui/react-icons";
import { Link } from "@tanstack/react-router";
import { Home, Inbox, Ship } from "lucide-react";
import { TypeH2 } from "../typography/type-h2";

// Menu items.
const items = [
  {
    title: "Home",
    url: "/",
    icon: Home,
  },
  {
    title: "Passes",
    url: "/passes",
    icon: Inbox,
  },
  {
    title: "Trade",
    url: "/trade",
    icon: LoopIcon,
  },
  // {
  //   title: "Bridge",
  //   url: "/bridge",
  //   icon: Ship,
  // },
  {
    title: "Create",
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
        <TypeH2 className="p-3">Eternum</TypeH2>
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
