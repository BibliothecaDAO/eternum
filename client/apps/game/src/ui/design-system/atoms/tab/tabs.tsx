import { useUISound } from "@/audio";
import { Tab } from "@/ui/design-system/atoms/tab/tab";
import { TabList } from "@/ui/design-system/atoms/tab/tab-list";
import { TabPanel } from "@/ui/design-system/atoms/tab/tab-panel";
import { TabPanels } from "@/ui/design-system/atoms/tab/tab-panels";
import { TabProvider } from "@/ui/design-system/atoms/tab/tab-provider";
import { Tab as HeadlessTab } from "@headlessui/react";
import clsx from "clsx";
import type { ReactNode } from "react";

export const VARIANTS: any = {
  default: {
    tab: {
      base: "px-3 py-1 !outline-none transition-colors duration-200 space-x-1 hover:bg-gold/20 border-3 border-transparent",
      active: "panel-gold text-gold",
      inactive: "text-gold",
    },
    tabList: "flex w-full justify-center",
  },
  primary: {
    tab: {
      base: "relative mx-1 rounded-t-xl text-gold transition-all duration-200 !outline-none text-sm py-2 px-4",
      active: "bg-yellow-900/20 text-yellow-100",
      inactive: "hover:bg-yellow-900/10",
    },
    tabList: "flex w-full justify-center p-2 panel-wood border-2 border-yellow-700 rounded-lg",
  },
  small: {
    tab: {
      base: "relative flex w-full items-center justify-center px-2 py-2 tracking-widest transition-all duration-200 focus-visible:ring-yellow-700 text-yellow-100",
      active: "bg-yellow-900/20 text-yellow-100",
      inactive: "hover:bg-yellow-900/10 text-gray-200",
    },
    tabList: "flex p-1 space-x-2 panel-wood border-2 border-yellow-700 rounded-lg",
  },
  inventory: {
    tab: {
      base: "group relative flex cursor-pointer items-center gap-2 border-b-[3px] border-transparent px-0 py-1 text-gold/70 !outline-none transition-colors duration-75",
      active: "border-gold text-gold",
      inactive: "hover:text-gold/90",
    },
    tabList: "flex w-full justify-start gap-4",
  },
  selection: {
    tab: {
      base: "flex flex-1 cursor-pointer items-center justify-center rounded-lg border border-gold/30 bg-black/30 px-2 py-2 text-gold/60 transition duration-150 !outline-none",
      active: "border-[#f4c24d] text-[#f4c24d] bg-black/55",
      inactive: "hover:border-gold/50 hover:text-gold/90",
    },
    tabList: "flex w-full gap-2",
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
  const playClick = useUISound("ui.click");

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
