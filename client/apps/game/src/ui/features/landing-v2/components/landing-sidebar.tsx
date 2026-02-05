import { ReactComponent as BlitzLogo } from "@/assets/icons/blitz-words-logo-g.svg";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Home, Settings, Trophy, User } from "lucide-react";
import { NavLink } from "react-router-dom";

interface SidebarItem {
  icon: React.ElementType;
  path?: string;
  action?: () => void;
  tooltip: string;
}

const sidebarItems: SidebarItem[] = [
  { icon: Home, path: "/", tooltip: "Home" },
  { icon: Trophy, path: "/leaderboard", tooltip: "Leaderboard" },
  { icon: User, path: "/profile", tooltip: "Profile" },
];

interface LandingSidebarProps {
  onSettingsClick?: () => void;
  walletButton?: React.ReactNode;
  className?: string;
}

/**
 * Icon-only left sidebar navigation.
 * Only visible on desktop (hidden on mobile, replaced by bottom nav).
 */
export const LandingSidebar = ({ onSettingsClick, walletButton, className }: LandingSidebarProps) => {
  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-20 hidden h-full w-16 flex-col items-center py-6 lg:flex",
        "bg-gradient-to-b from-black/60 via-black/40 to-black/60 backdrop-blur-sm",
        "border-r border-gold/10",
        className,
      )}
    >
      {/* Logo at top */}
      <div className="mb-8">
        <NavLink to="/" className="block transition-transform duration-200 hover:scale-110" title="Realms: Blitz">
          <BlitzLogo className="h-10 w-10 text-gold opacity-90 transition-opacity hover:opacity-100" />
        </NavLink>
      </div>

      {/* Navigation items */}
      <nav className="flex flex-1 flex-col items-center gap-2">
        {sidebarItems.map((item) => {
          const Icon = item.icon;

          if (item.path) {
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === "/"}
                className={({ isActive }) =>
                  cn(
                    "group relative flex h-12 w-12 items-center justify-center rounded-lg",
                    "transition-all duration-200",
                    "hover:bg-gold/10 hover:scale-105",
                    "active:scale-95",
                    isActive && [
                      "bg-gold/15",
                      // Active indicator bar
                      "before:absolute before:left-0 before:h-8 before:w-1 before:rounded-r before:bg-gold",
                      "before:shadow-[0_0_10px_rgba(223,170,84,0.5)]",
                    ],
                  )
                }
                title={item.tooltip}
              >
                {({ isActive }) => (
                  <Icon
                    className={cn(
                      "h-5 w-5 transition-all duration-200",
                      isActive ? "text-gold" : "text-gold/60 group-hover:text-gold",
                    )}
                  />
                )}
              </NavLink>
            );
          }

          return null;
        })}
      </nav>

      {/* Wallet connector above settings */}
      {walletButton && <div className="mb-2">{walletButton}</div>}

      {/* Settings at bottom */}
      <button
        type="button"
        onClick={onSettingsClick}
        className={cn(
          "group flex h-12 w-12 items-center justify-center rounded-lg",
          "transition-all duration-200",
          "hover:bg-gold/10 hover:scale-105",
          "active:scale-95",
        )}
        title="Settings"
      >
        <Settings className="h-5 w-5 text-gold/60 transition-all duration-200 group-hover:text-gold group-hover:rotate-45" />
      </button>
    </aside>
  );
};
