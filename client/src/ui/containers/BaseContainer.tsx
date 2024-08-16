import { ReactComponent as Collapse } from "@/assets/icons/common/collapse.svg";
import { ReactComponent as Expand } from "@/assets/icons/common/expand.svg";
import clsx from "clsx";
import { forwardRef, ReactNode, useState } from "react";

interface BaseContainerProps {
  children?: ReactNode;
  className?: string;
  expandable?: boolean;
  expandedClassName?: string;
  collapsedClassName?: string;
}
export const BaseContainer = forwardRef<HTMLDivElement, BaseContainerProps>(
  ({ children, className, expandable, expandedClassName, collapsedClassName }: BaseContainerProps, ref) => {
    const [expanded, setExpanded] = useState(false);
    return (
      <div
        ref={ref}
        className={clsx(
          " flex relative flex-col transition-all duration-400 bg-black/90 shadow-2xl border-gradient border rounded-sm bg-hex-bg animatedBackground",
          className,
          expanded ? expandedClassName : collapsedClassName,
        )}
      >
        {children}
        {expandable &&
          (expanded ? (
            <Collapse
              onClick={() => setExpanded(false)}
              className="absolute w-4 h-4 transition-colors duration-200 cursor-pointer top-4 right-4 fill-gold hover:fill-white"
            />
          ) : (
            <Expand
              onClick={() => setExpanded(true)}
              className="absolute w-4 h-4 transition-colors duration-200 cursor-pointer top-4 right-4 fill-gold hover:fill-white"
            />
          ))}
      </div>
    );
  },
);
