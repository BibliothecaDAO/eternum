import type * as PopperJS from "@popperjs/core";
import React, { useCallback, useRef, useState } from "react";
import { usePopper } from "react-popper";
import clsx from "clsx";

type TooltipProps = {
  tooltipText: React.ReactElement;
  placement?: PopperJS.Placement;
  enterDelay?: number;
  leaveDelay?: number;
} & React.HTMLAttributes<HTMLDivElement>;

export const Tooltip: React.FC<TooltipProps> = (props) => {
  const { children, tooltipText, enterDelay = 250, leaveDelay = 150, placement = "bottom", className } = props;

  const [isOpen, setIsOpen] = useState(false);
  const [referenceElement, setReferenceElement] = useState<HTMLDivElement | null>(null);
  const [popperElement, setPopperElement] = useState<HTMLDivElement | null>(null);
  const { styles, attributes } = usePopper(referenceElement, popperElement, {
    placement,
    modifiers: [{ name: "offset", options: { offset: [0, 4] } }],
  });

  const enterTimeout = useRef<NodeJS.Timeout>();
  const leaveTimeout = useRef<NodeJS.Timeout>();
  const handleMouseEnter = useCallback(() => {
    leaveTimeout.current && clearTimeout(leaveTimeout.current);
    enterTimeout.current = setTimeout(() => setIsOpen(true), enterDelay);
  }, [enterDelay]);
  const handleMouseLeave = useCallback(() => {
    enterTimeout.current && clearTimeout(enterTimeout.current);
    leaveTimeout.current = setTimeout(() => setIsOpen(false), leaveDelay);
  }, [leaveDelay]);

  return (
    <div className={clsx("relative", className)}>
      <div
        ref={setReferenceElement}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="relative w-full"
      >
        {children}
      </div>

      <div
        ref={setPopperElement}
        style={{
          ...styles.popper,
          visibility: isOpen ? "visible" : "hidden",
        }}
        {...attributes.popper}
        className={`transition-opacity ${isOpen ? "opacity-100" : "opacity-0"}`}
      >
        {tooltipText}
      </div>
    </div>
  );
};
