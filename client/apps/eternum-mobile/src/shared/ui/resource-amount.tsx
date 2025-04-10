import { cn } from "@/shared/lib/utils";
import { findResourceById } from "@bibliothecadao/types";
import { ResourceIcon } from "./resource-icon";

interface ResourceAmountProps {
  resourceId: number;
  amount: number;
  size?: "sm" | "md" | "lg";
  direction?: "horizontal" | "vertical";
  showName?: boolean;
  className?: string;
}

export function ResourceAmount({
  resourceId,
  amount,
  size = "md",
  direction = "horizontal",
  showName = true,
  className,
}: ResourceAmountProps) {
  const sizeClasses = {
    sm: "text-xs gap-1",
    md: "text-sm gap-2",
    lg: "text-lg gap-3",
  };

  const iconSizes = {
    sm: 16,
    md: 24,
    lg: 32,
  };

  const resource = findResourceById(resourceId);

  return (
    <div className={cn("flex items-center", direction === "vertical" && "flex-col", sizeClasses[size], className)}>
      <ResourceIcon resourceId={resourceId} size={iconSizes[size]} />
      <span className="font-medium">{amount}</span>
      {showName && resource && <span className="text-muted-foreground capitalize">{resource.trait}</span>}
    </div>
  );
}
