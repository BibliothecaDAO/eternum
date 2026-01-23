import { cn } from "@/shared/lib/utils";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";

interface LoadingProps {
  className?: string;
  size?: number;
  text?: string;
}

export function Loading({ className, size = 24, text = "Loading" }: LoadingProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2", className)}>
      <Loader2 className="animate-spin" size={size} />
      <p className="text-sm text-muted-foreground animate-pulse">{text}</p>
    </div>
  );
}
