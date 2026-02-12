import * as React from "react";
import { cn } from "@/utils/utils";
import * as ProgressPrimitive from "@radix-ui/react-progress";

interface ProgressProps
  extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  indicatorColor?: string;
}

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  ProgressProps
>(({ className, value, max, indicatorColor, ...props }, ref) => {
  const safeMax =
    typeof max === "number" && Number.isFinite(max) && max > 0 ? max : 100;
  const safeValue =
    typeof value === "number" && Number.isFinite(value)
      ? Math.min(Math.max(value, 0), safeMax)
      : 0;
  const progressPercent = (safeValue / safeMax) * 100;

  return (
    <ProgressPrimitive.Root
      ref={ref}
      className={cn(
        "bg-primary/20 relative h-2 w-full overflow-hidden rounded-full",
        className,
      )}
      value={safeValue}
      max={safeMax}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn(
          "h-full w-full flex-1 transition-all",
          indicatorColor ?? "bg-primary",
        )}
        style={{ transform: `translateX(-${100 - progressPercent}%)` }}
      />
    </ProgressPrimitive.Root>
  );
});
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
