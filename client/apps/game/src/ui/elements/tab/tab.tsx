import { TabContext } from "@/ui/elements/tab/tab-provider";
import { VARIANTS } from "@/ui/elements/tab/tabs";
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
          VARIANTS[variant].tab.base,
          selected ? VARIANTS[variant].tab.active : VARIANTS[variant].tab.inactive,
          className,
          "mx-0.5",
        )
      }
      {...props}
    >
      {() => {
        return <>{children}</>;
      }}
    </HeadlessTab>
  );
};
