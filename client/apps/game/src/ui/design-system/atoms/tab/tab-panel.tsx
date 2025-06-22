import { Tab } from "@headlessui/react";
import clsx from "clsx";
import type { ComponentProps } from "react";

type TabPanelProps = ComponentProps<"div">;

export const TabPanel = ({ className, children, ...props }: TabPanelProps) => {
  return (
    // @ts-ignore
    <Tab.Panel className={clsx("outline-none w-full overflow-auto", className)} {...props}>
      {children}
    </Tab.Panel>
  );
};
