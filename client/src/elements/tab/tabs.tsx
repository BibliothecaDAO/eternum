import { Tab as HeadlessTab } from "@headlessui/react";
import clsx from "clsx";
import type { ReactNode } from "react";
import { Tab } from "./tab";
import { TabList } from "./TabList";
import { TabPanel } from "./TabPanel";
import { TabPanels } from "./TabPanels";
import { TabProvider } from "./TabProvider";
import { soundSelector, useUiSounds } from "../../hooks/useUISound";

export const VARIANTS: any = {
  default: {
    tab: {
      base: "text-xxs px-3 !outline-none border border-transparent transition-color duration-200",
      active: "border !border-white rounded-md text-white",
      inactive: "text-gray-gold",
    },
    tabList: "flex w-full justify-center bg-gradient-to-t from-black to-[#151515]  p-2 border-y border-gold",
  },
  primary: {
    tab: {
      base: "relative mx-1 rounded-t-xl text-gold border-t transition-all duration-200 border-transparent !outline-none -mb-[1px] text-xs py-[12px] px-4",
      active: "!border-gold text-white bg-gradient-to-b from-black to-[#151515]",
      inactive: "",
    },
    tabList: "flex w-full justify-center px-2",
  },
  small: {
    tab: {
      base: "relative flex w-full items-center justify-center px-2 py-2 tracking-widest hover:border-yellow-700 transition-all duration-450 rounded focus-visible:ring-yellow-700 hover:bg-gradient-to-r hover:from-red-600 hover:to-red-900 hover:text-yellow-100 hover:bg-cta-100 hover:bg-red-700 shadow-lg border-b-2 border-l  text-yellow-100 border-transparent paper",
      active: "bg-gradient-to-r from-red-600 to-red-900 text-yellow-100 border-yellow-700",
      inactive: "bg-transparent text-gray-200",
    },
    tabList: "flex p-1 space-x-2 border rounded-lg border-yellow-800/40",
  },
};

export interface TabsProps {
  children: ReactNode;
  variant?: keyof typeof VARIANTS;
  className?: string;
  selectedIndex?: number;
  onChange?: (index: number) => void;
}

export const Tabs = ({ children, className, variant = "default", selectedIndex = 0, onChange }: TabsProps) => {
  const { play: playClick } = useUiSounds(soundSelector.click);

  return (
    <TabProvider variant={variant}>
      {onChange ? (
        <HeadlessTab.Group
          as="div"
          className={clsx("flex  flex-col ", className)}
          selectedIndex={selectedIndex}
          onChange={(e) => {
            onChange(e);
            playClick();
          }}
        >
          {children}
        </HeadlessTab.Group>
      ) : (
        <HeadlessTab.Group as="div" className={clsx("flex flex-col ", className)}>
          {children}
        </HeadlessTab.Group>
      )}
    </TabProvider>
  );
};

Tabs.List = TabList;
Tabs.Panels = TabPanels;
Tabs.Panel = TabPanel;
Tabs.Tab = Tab;
