import React from "react";
import { TopNavigation } from "../modules/top-navigation";
import { WrongNetworkDialog } from "../modules/wrong-network-dialog";
interface DashboardLayoutProps {
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  return (
    <div className="flex flex-col h-[calc(100vh)] w-full dark:bg-dark-wood">
      <div className="">
        <TopNavigation />
      </div>
      <div className="flex-grow overflow-auto rounded-t-xl">{children}</div>
      <WrongNetworkDialog />
    </div>
  );
};
