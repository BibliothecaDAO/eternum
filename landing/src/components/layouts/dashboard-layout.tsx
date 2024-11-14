import React from "react";
import { TopNavigation } from "../modules/top-navigation";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  return (
    <div className="flex flex-col h-[calc(100vh)] w-full">
      <div className="p-4">
        <TopNavigation />
      </div>
      <div className="flex-grow p-4 border-gold/15 border-t overflow-auto rounded">{children}</div>
    </div>
  );
};
