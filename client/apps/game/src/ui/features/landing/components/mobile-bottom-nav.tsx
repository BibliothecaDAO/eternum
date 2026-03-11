import { cn } from "@/ui/design-system/atoms/lib/utils";
import { useLocation, useSearchParams } from "react-router-dom";
import { getSectionFromPath, getActiveSubItem } from "../context/navigation-config";

interface MobileBottomNavProps {
  className?: string;
}

/**
 * Bottom tab bar navigation for mobile devices.
 * Shows contextual sub-items based on the current section.
 * Hidden on desktop (replaced by sidebar).
 */
export const MobileBottomNav = ({ className }: MobileBottomNavProps) => {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeSection = getSectionFromPath(location.pathname);
  const currentTab = searchParams.get("tab");
  const activeSubItem = getActiveSubItem(activeSection, currentTab);

  const handleTabClick = (tab: string | null) => {
    const nextSearchParams = new URLSearchParams(searchParams);

    if (tab === null) {
      nextSearchParams.delete("tab");
    } else {
      nextSearchParams.set("tab", tab);
    }

    setSearchParams(nextSearchParams);
  };

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-30 lg:hidden",
        "flex items-center justify-around px-2 py-2",
        "bg-black/90 backdrop-blur-md",
        "border-t border-gold/20",
        // Safe area for mobile devices with notches
        "pb-safe",
        className,
      )}
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.5rem)" }}
      aria-label="Mobile navigation"
    >
      {activeSection.subMenu.map((item) => {
        const isActive = activeSubItem.id === item.id;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => handleTabClick(item.tab)}
            className={cn(
              "relative flex flex-col items-center gap-1 px-4 py-2 rounded-lg flex-1",
              "transition-all duration-200",
              "active:scale-95",
              isActive ? "text-gold" : "text-gold/50 hover:text-gold/70",
            )}
          >
            <span className={cn("text-xs font-semibold uppercase tracking-wide", isActive && "scale-105")}>
              {item.label}
            </span>
            {/* Active indicator line */}
            {isActive && (
              <span className="absolute -bottom-1 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-gold shadow-[0_0_6px_rgba(223,170,84,0.8)]" />
            )}
          </button>
        );
      })}
    </nav>
  );
};
