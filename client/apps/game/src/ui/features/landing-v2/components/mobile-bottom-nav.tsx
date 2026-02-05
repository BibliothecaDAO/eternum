import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Home, Settings, ShoppingCart, Trophy, User } from "lucide-react";
import { NavLink } from "react-router-dom";

interface NavItem {
  icon: React.ElementType;
  label: string;
  path?: string;
  action?: () => void;
}

const navItems: NavItem[] = [
  { icon: Home, label: "Play", path: "/" },
  { icon: Trophy, label: "Ranks", path: "/leaderboard" },
  { icon: User, label: "Profile", path: "/profile" },
  { icon: ShoppingCart, label: "Markets", path: "/markets" },
];

interface MobileBottomNavProps {
  onSettingsClick?: () => void;
  className?: string;
}

/**
 * Bottom tab bar navigation for mobile devices.
 * Hidden on desktop (replaced by sidebar).
 */
export const MobileBottomNav = ({ onSettingsClick, className }: MobileBottomNavProps) => {
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
      {navItems.map((item) => {
        const Icon = item.icon;

        if (item.path) {
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              className={({ isActive }) =>
                cn(
                  "relative flex flex-col items-center gap-1 px-3 py-2 rounded-lg",
                  "transition-all duration-200",
                  "active:scale-95",
                  isActive ? "text-gold" : "text-gold/50 hover:text-gold/70",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={cn("h-5 w-5 transition-transform", isActive && "scale-110")} />
                  <span className="text-[10px] font-medium">{item.label}</span>
                  {/* Active indicator dot */}
                  {isActive && (
                    <span className="absolute -top-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-gold shadow-[0_0_6px_rgba(223,170,84,0.8)]" />
                  )}
                </>
              )}
            </NavLink>
          );
        }

        return null;
      })}

      {/* Settings button */}
      <button
        type="button"
        onClick={onSettingsClick}
        className={cn(
          "flex flex-col items-center gap-1 px-3 py-2 rounded-lg",
          "text-gold/50 transition-all duration-200",
          "hover:text-gold/70 active:scale-95",
        )}
      >
        <Settings className="h-5 w-5" />
        <span className="text-[10px] font-medium">Settings</span>
      </button>
    </nav>
  );
};
