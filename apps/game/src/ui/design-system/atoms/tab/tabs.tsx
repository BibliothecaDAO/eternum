import { useUISound } from "@/audio";
import { Tab } from "@/ui/design-system/atoms/tab/tab";
import { TabList } from "@/ui/design-system/atoms/tab/tab-list";
import { TabPanel } from "@/ui/design-system/atoms/tab/tab-panel";
import { TabPanels } from "@/ui/design-system/atoms/tab/tab-panels";
import { TabProvider } from "@/ui/design-system/atoms/tab/tab-provider";
import { Tab as HeadlessTab } from "@headlessui/react";
import clsx from "clsx";
import type { ReactNode } from "react";

/**
 * The older tab strips, drawn as the HUD sheet's tabs (hud-sheet.css .ui-tabs, .ui-tab): one look, the chosen tab in
 * the age's accent over its rule. A variant now only lays its strip out: centred, stretched, or along the foot.
 */
export const VARIANTS = {
  default: { tab: "", tabList: "w-full justify-center" },
  primary: { tab: "", tabList: "w-full justify-center" },
  small: { tab: "flex-1 justify-center", tabList: "" },
  inventory: { tab: "", tabList: "w-full justify-start" },
  entityBanner: { tab: "flex-1 justify-center", tabList: "mt-auto w-full" },
  selection: { tab: "flex-1 justify-center", tabList: "w-full" },
};

interface TabsProps {
  children: ReactNode;
  variant?: keyof typeof VARIANTS;
  className?: string;
  selectedIndex?: number;
  onChange?: (index: number) => void;
}

export const Tabs = ({ children, className, variant = "default", selectedIndex = 0, onChange }: TabsProps) => {
  const playClick = useUISound("ui.click");

  return (
    <TabProvider variant={variant}>
      {onChange ? (
        <HeadlessTab.Group
          as="div"
          className={clsx("flex flex-col", className)}
          selectedIndex={selectedIndex}
          onChange={(e) => {
            onChange(e);
            playClick();
          }}
        >
          {children}
        </HeadlessTab.Group>
      ) : (
        <HeadlessTab.Group as="div" className={clsx("flex flex-col", className)}>
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
