import React from "react";
import { TopNavigation } from "../modules/top-navigation";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  return (
    <div className="flex flex-col h-[calc(100vh)] w-full p-4">
      <div className="pb-4">
        <TopNavigation />
      </div>
      <div className="flex-grow p-4 bg-dark-brown border-gold/5 border-2 overflow-auto rounded-2xl">{children}</div>
    </div>
  );
};
