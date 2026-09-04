import { Tab } from "@headlessui/react";
import clsx from "clsx";
import type { ComponentProps } from "react";

type TabPanelProps = ComponentProps<typeof Tab.Panel> & {
  scrollable?: boolean;
};

export const TabPanel = ({ className, children, unmount = false, scrollable = true, ...props }: TabPanelProps) => {
  return (
    <Tab.Panel
      className={clsx("outline-none w-full", scrollable ? "overflow-auto" : "overflow-hidden", className)}
      unmount={unmount}
      {...props}
    >
      {children}
    </Tab.Panel>
  );
};
