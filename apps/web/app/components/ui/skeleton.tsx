import { cn } from "@/utils/utils";

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("bg-primary/20 animate-pulse rounded-md", className)}
      {...props}
    />
  );
}

export { Skeleton };
