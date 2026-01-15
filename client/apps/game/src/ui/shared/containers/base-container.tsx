import { ReactComponent as Collapse } from "@/assets/icons/common/collapse.svg";
import { ReactComponent as Expand } from "@/assets/icons/common/expand.svg";
import clsx from "clsx";
import { forwardRef, memo, ReactNode, useState } from "react";

interface BaseContainerProps {
  style?: React.CSSProperties;
  children?: ReactNode;
  className?: string;
  expandable?: boolean;
  expandedClassName?: string;
  collapsedClassName?: string;
  scrollbarSide?: "left" | "right";
}
export const BaseContainer = memo(
  forwardRef<HTMLDivElement, BaseContainerProps>(
    (
      { children, className, expandable, expandedClassName, collapsedClassName, scrollbarSide }: BaseContainerProps,
      ref,
    ) => {
      const [expanded, setExpanded] = useState(false);
      return (
        <div
          ref={ref}
          className={clsx(
            "flex relative flex-col transition-all duration-400 bg-dark-wood",
            {
              "[direction:rtl]": scrollbarSide === "left",
            },
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
  ),
);
