import clsx from "clsx";
import { ReactNode } from "react";

interface DropdownListProps {
  children: ReactNode;
  className?: string;
  maxHeight?: "sm" | "md" | "lg" | "xl";
  padding?: "none" | "xs" | "sm";
  isEmpty?: boolean;
  emptyState?: ReactNode;
}

const maxHeightClassMap = {
  sm: "max-h-40",
  md: "max-h-64",
  lg: "max-h-80",
  xl: "max-h-[28rem]",
};

const paddingClassMap = {
  none: "",
  xs: "p-1",
  sm: "p-2",
};

export const DropdownList = ({
  children,
  className,
  maxHeight = "md",
  padding = "xs",
  isEmpty = false,
  emptyState = <div className="px-2 py-1 text-xs text-gold/50">No results found</div>,
}: DropdownListProps) => (
  <div
    className={clsx(
      "overflow-y-auto border border-gold/20 rounded-md bg-black/20 backdrop-blur-sm",
      maxHeightClassMap[maxHeight],
      paddingClassMap[padding],
      className,
    )}
  >
    {isEmpty ? emptyState : children}
  </div>
);

export default DropdownList;
