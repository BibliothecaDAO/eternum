import { ReactNode, useState, forwardRef } from "react";
import clsx from "clsx";
import { ReactComponent as Expand } from "../assets/icons/common/expand.svg";
import { ReactComponent as Collapse } from "../assets/icons/common/collapse.svg";

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
          "p-2 flex shadow-black/30 relative shadow-md flex-col transition-all duration-500 border border-gold rounded-xl  container-bg-gradient",
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
