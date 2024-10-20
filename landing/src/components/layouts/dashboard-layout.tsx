import React from "react";
import { Sidebar } from "../modules/sidebar";
import { TopNavigation } from "../modules/top-navigation";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  return (
    <div className="flex gap-4 p-8 bg-light-brown">
      <Sidebar />

      <div className="flex flex-col h-[calc(100vh-4rem)] w-full">
        <div className="pb-4">
          <TopNavigation />
        </div>
        <div className="flex-grow p-4 bg-dark-brown border-gold/5 border-2 overflow-auto rounded-2xl">{children}</div>
      </div>
    </div>
  );
};
