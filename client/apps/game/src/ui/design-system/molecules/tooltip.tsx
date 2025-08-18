import { useUIStore } from "@/hooks/store/use-ui-store";
import clsx from "clsx";
import throttle from "lodash/throttle";
import { useEffect, useRef, useState } from "react";

type TooltipProps = {
  className?: string;
};

export const Tooltip = ({ className }: TooltipProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const tooltip = useUIStore((state) => state.tooltip);
  const position = tooltip?.position ? tooltip.position : "top";
  const [tooltipSize, setTooltipSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (tooltip?.fixed) return;

    const updateTooltipSize = () => {
      if (ref.current) {
        setTooltipSize({
          width: ref.current.offsetWidth,
          height: ref.current.offsetHeight,
        });
      }
    };

    const mouseMoveHandler = throttle((e: MouseEvent) => {
      if (ref.current) {
        updateTooltipSize();

        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        let x = e.clientX;
        let y = e.clientY;

        // Apply position-specific offsets
        if (position === "top") {
          y = y - tooltipSize.height - 20; // Increased from 10px to 20px gap
        } else if (position === "bottom") {
          y = y + 30; // Increased from 20px to 30px below cursor
        } else if (position === "left") {
          x = x - tooltipSize.width - 20; // Increased from 10px to 20px
          y = y - tooltipSize.height / 2;
        } else if (position === "right") {
          x = x + 30; // Increased from 20px to 30px
          y = y - tooltipSize.height / 2;
        }

        // Ensure tooltip stays within viewport bounds
        if (x + tooltipSize.width > viewportWidth) {
          x = viewportWidth - tooltipSize.width - 5;
        }
        if (x < 5) x = 5;

        if (y + tooltipSize.height > viewportHeight) {
          y = viewportHeight - tooltipSize.height - 5;
        }
        if (y < 5) y = 5;

        ref.current.style.left = `${x}px`;
        ref.current.style.top = `${y}px`;
      }
    }, 10);

    // Initial size calculation when tooltip appears
    updateTooltipSize();

    document.getElementById("world")?.addEventListener("mousemove", mouseMoveHandler);
    document.body.addEventListener("mousemove", mouseMoveHandler);

    return () => {
      document.getElementById("world")?.removeEventListener("mousemove", mouseMoveHandler);
      document.body.removeEventListener("mousemove", mouseMoveHandler);
      mouseMoveHandler.cancel();
    };
  }, [tooltip?.fixed, position, tooltipSize.width, tooltipSize.height]);

  // Add cleanup effect for when tooltips should be cleared on rapid interactions
  useEffect(() => {
    const clearTooltip = () => {
      const setTooltip = useUIStore.getState().setTooltip;
      setTooltip(null);
    };

    // Clear tooltip on any click to handle overlapping elements
    document.addEventListener("click", clearTooltip);
    // Clear tooltip on drag start to handle dragging interactions
    document.addEventListener("dragstart", clearTooltip);

    return () => {
      document.removeEventListener("click", clearTooltip);
      document.removeEventListener("dragstart", clearTooltip);
    };
  }, []);

  return (
    <>
      {tooltip && tooltip.content && (
        <div
          ref={ref}
          style={tooltip.fixed ? { left: tooltip.fixed.x, top: tooltip.fixed.y } : undefined}
          className={clsx(
            "fixed z-[250] panel-wood inline-flex border text-xxs px-4 py-1 bg-dark-wood flex-col justify-start items-center text-gold",
            className,
          )}
        >
          {tooltip.content}
        </div>
      )}
    </>
  );
};
