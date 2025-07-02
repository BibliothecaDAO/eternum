import { useAccount } from "@starknet-react/core";
import { Link } from "@tanstack/react-router";
import { Database, Scale, User2 } from "lucide-react";
import React from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "../components/ui/sidebar";
import { TopNavigation } from "./modules/top-navigation";
import { WrongNetworkDialog } from "./modules/wrong-network-dialog";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const sidebarItems = [
  {
    title: "Marketplace",
    url: "/",
    icon: Scale,
  },
  {
    title: "Activity",
    url: "/activity",
    icon: Database,
  },
  {
    title: "My Empire",
    url: "/$address/",
    icon: User2,
  },
];

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const { address } = useAccount();
  return (
    <SidebarProvider>
      <div className="flex h-[100vh] w-full dark:bg-dark-wood">
        {/* Sidebar */}
        <Sidebar
          collapsible="icon"
          className="bg-[url('/images/textures/dark-wood.png')] bg-cover border-r border-sidebar-border"
        >
          <SidebarContent className="h-full">
            <Link to="/">
              <img src="/collections/rw-logo.svg" alt="Realms World Market" className="w-18 max-w-32 mt-4 mx-auto" />
            </Link>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {sidebarItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild tooltip={item.title}>
                        <Link to={item.url} className="flex items-center gap-2">
                          <item.icon className="w-5 h-5" />
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
        <SidebarInset>
          {/* Main content area */}
          <div className="flex flex-col flex-1 min-w-0 h-full">
            <div>
              <TopNavigation />
            </div>
            <div className="flex-grow overflow-auto rounded-t-xl">{children}</div>
            <WrongNetworkDialog />
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};
