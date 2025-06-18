import { Tab } from "@headlessui/react";
import clsx from "clsx";
import type { ComponentProps } from "react";

type TabPanelsProps = ComponentProps<"article">;

export const TabPanels = ({ className, children, ...props }: TabPanelsProps) => {
  return (
    // @ts-ignore
    <Tab.Panels as="article" className={clsx("flex flex-1", className)} {...props}>
      {children}
    </Tab.Panels>
  );
};
