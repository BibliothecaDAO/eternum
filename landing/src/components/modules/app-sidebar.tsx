import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { LoopIcon } from "@radix-ui/react-icons";
import { Link } from "@tanstack/react-router";
import { Earth, Home, Inbox, Ship } from "lucide-react";

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
  {
    title: "Bridge",
    url: "/bridge",
    icon: Ship,
  },
  {
    title: "Mint",
    url: "/mint",
    icon: Ship,
  },
  {
    title: "My Empire",
    url: "/my-empire",
    icon: Earth,
  },
];

export function AppSidebar() {
  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Eternum</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <Link to={item.url}>
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
