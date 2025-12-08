import { Tab } from "@headlessui/react";
import clsx from "clsx";
import type { ComponentProps } from "react";

type TabPanelProps = ComponentProps<typeof Tab.Panel>;

export const TabPanel = ({ className, children, unmount = false, ...props }: TabPanelProps) => {
  return (
    <Tab.Panel className={clsx("outline-none w-full overflow-auto", className)} unmount={unmount} {...props}>
      {children}
    </Tab.Panel>
  );
};
