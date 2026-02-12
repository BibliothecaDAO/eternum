import Crown from "lucide-react/dist/esm/icons/crown";
import Users from "lucide-react/dist/esm/icons/users";
import X from "lucide-react/dist/esm/icons/x";
import { toast } from "sonner";

import { cn } from "@/ui/design-system/atoms/lib/utils";

interface BigEventToastProps {
  toastId: string | number;
  title: string;
  description: string;
  type: "hyperstructure" | "capture" | "elimination";
  playerName?: string;
  onDismiss?: () => void;
}

const EVENT_STYLES = {
  hyperstructure: {
    bgColor: "bg-gradient-to-r from-purple-900/90 to-purple-800/90",
    borderColor: "border-purple-400/50",
    textColor: "text-purple-100",
    icon: Crown,
    iconColor: "text-purple-300",
  },
  capture: {
    bgColor: "bg-gradient-to-r from-red-900/90 to-orange-800/90", 
    borderColor: "border-red-400/50",
    textColor: "text-red-100",
    icon: Crown,
    iconColor: "text-red-300",
  },
  elimination: {
    bgColor: "bg-gradient-to-r from-gray-900/90 to-gray-800/90",
    borderColor: "border-gray-400/50", 
    textColor: "text-gray-100",
    icon: Users,
    iconColor: "text-gray-300",
  },
};

export function BigEventToast({
  toastId,
  title,
  description,
  type,
  playerName,
  onDismiss,
}: BigEventToastProps) {
  const style = EVENT_STYLES[type];
  const Icon = style.icon;

  return (
    <div 
      className={cn(
        "pointer-events-auto overflow-hidden rounded-lg border p-4 shadow-lg w-[320px]",
        style.bgColor,
        style.borderColor
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn("flex-shrink-0 mt-1", style.iconColor)}>
          <Icon className="h-6 w-6" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className={cn("text-sm font-bold leading-tight", style.textColor)}>
            📰 NEWS FLASH
          </div>
          <div className={cn("text-lg font-bold mt-1", style.textColor)}>
            {title}
          </div>
          <div className={cn("text-sm mt-2 opacity-90", style.textColor)}>
            {description}
          </div>
          {playerName && (
            <div className={cn("text-xs mt-2 font-semibold", style.iconColor)}>
              Player: {playerName}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            onDismiss?.();
            toast.dismiss(toastId);
          }}
          className={cn(
            "flex-shrink-0 rounded p-1 transition-colors",
            style.textColor,
            "hover:bg-white/10"
          )}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}