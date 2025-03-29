import { soundSelector, useUiSounds } from "@/hooks/helpers/use-ui-sound";
import { Tab } from "@/ui/elements/tab/tab";
import { TabList } from "@/ui/elements/tab/tab-list";
import { TabPanel } from "@/ui/elements/tab/tab-panel";
import { TabPanels } from "@/ui/elements/tab/tab-panels";
import { TabProvider } from "@/ui/elements/tab/tab-provider";
import { Tab as HeadlessTab } from "@headlessui/react";
import clsx from "clsx";
import type { ReactNode } from "react";

export const VARIANTS: any = {
  default: {
    tab: {
      base: " px-3 py-1 !outline-none border-y-2 border-transparent rounded  transition-color duration-200 hover:bg-gold   space-x-1 hover:text-brown font-bold",
      active: "bg-gold text-brown",
      inactive: "text-gold",
    },
    tabList: "flex w-full justify-center  p-2 ",
  },
  primary: {
    tab: {
      base: "relative mx-1 rounded-t-xl text-gold border-t transition-all duration-200 border-transparent !outline-none -mb-[1px] text-xs py-[12px] px-4",
      active: "",
      inactive: "",
    },
    tabList: "flex w-full justify-center px-2",
  },
  small: {
    tab: {
      base: "relative flex w-full items-center justify-center px-2 py-2 tracking-widest hover:border-yellow-700 transition-all duration-450  focus-visible:ring-yellow-700 hover:bg-gradient-to-r hover:from-red-600 hover:to-red-900 hover:text-yellow-100 hover:bg-cta-100 hover:bg-red-700 shadow-lg border-b-2 border-l  text-yellow-100 border-transparent paper",
      active: "bg-gradient-to-r from-red-600 to-red-900 text-yellow-100 border-yellow-700",
      inactive: "bg-transparent text-gray-200",
    },
    tabList: "flex p-1 space-x-2 rounded-lg",
  },
};

interface TabsProps {
  children: ReactNode;
  variant?: keyof typeof VARIANTS;
  className?: string;
  selectedIndex?: number;
  onChange?: (index: number) => void;
  size?: "small" | "medium" | "large";
}

export const Tabs = ({
  children,
  className,
  size = "small",
  variant = "default",
  selectedIndex = 0,
  onChange,
}: TabsProps) => {
  const { play: playClick } = useUiSounds(soundSelector.click);

  return (
    <TabProvider variant={variant}>
      {onChange ? (
        <HeadlessTab.Group
          as="div"
          className={clsx("flex flex-col", className, {
            "text-xs": size === "small",
            "text-base": size === "medium",
            "text-xl": size === "large",
          })}
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
