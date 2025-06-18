import { TabContext } from "@/ui/design-system/atoms/tab/tab-provider";
import { VARIANTS } from "@/ui/design-system/atoms/tab/tabs";
import { Tab } from "@headlessui/react";
import clsx from "clsx";
import type { ComponentProps } from "react";
import { useContext } from "react";

type TabListProps = ComponentProps<"div">;

export const TabList = ({ className, children, ...props }: TabListProps) => {
  const { variant } = useContext(TabContext)!;

  return (
    // @ts-ignore
    <Tab.List className={clsx(VARIANTS[variant].tabList, className)} {...props}>
      {children}
    </Tab.List>
  );
};
