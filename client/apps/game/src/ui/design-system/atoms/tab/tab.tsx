import { TabContext } from "@/ui/design-system/atoms/tab/tab-provider";
import { VARIANTS } from "@/ui/design-system/atoms/tab/tabs";
import { Tab as HeadlessTab } from "@headlessui/react";
import clsx from "clsx";
import type { ComponentProps } from "react";
import { useContext } from "react";

type TabProps = ComponentProps<"button"> & { noText?: boolean };

export const Tab = ({ className, children, noText, ...props }: TabProps) => {
  const { variant } = useContext(TabContext)!;

  return (
    // @ts-ignore
    <HeadlessTab
      className={({ selected }) =>
        clsx(
          "group",
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:pointer-events-none",
          VARIANTS[variant].tab.base,
          selected ? VARIANTS[variant].tab.active : VARIANTS[variant].tab.inactive,
          className,
          "mx-0.5",
        )
      }
      {...props}
    >
      {({ selected }) => (
        <span data-selected={selected ? "true" : "false"} className="flex items-center gap-1">
          {children}
        </span>
      )}
    </HeadlessTab>
  );
};
