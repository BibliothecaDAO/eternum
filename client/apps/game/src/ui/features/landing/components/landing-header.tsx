import { ReactComponent as RealmsLogo } from "@/assets/icons/rw-logo.svg";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Home, Menu, Moon, Settings, Sun, TrendingUp, Trophy, User, X } from "lucide-react";
import { useState, useCallback } from "react";
import { NavLink, useLocation, useSearchParams } from "react-router-dom";
import { getSectionFromPath, getActiveSubItem } from "../context/navigation-config";

interface LandingHeaderProps {
  walletButton?: React.ReactNode;
  onSettingsClick?: () => void;
  className?: string;
}

interface MobileNavItem {
  icon: React.ElementType;
  label: string;
  path: string;
}

const mobileNavItems: MobileNavItem[] = [
  { icon: Home, label: "Play", path: "/" },
  { icon: Trophy, label: "Ranks", path: "/leaderboard" },
  { icon: User, label: "Profile", path: "/profile" },
  { icon: TrendingUp, label: "Markets", path: "/markets" },
];

/**
 * Mobile hamburger menu drawer
 */
const MobileMenuDrawer = ({
  isOpen,
  onClose,
  onSettingsClick,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSettingsClick?: () => void;
}) => {
  const location = useLocation();

  const handleSettingsClick = useCallback(() => {
    onClose();
    onSettingsClick?.();
  }, [onClose, onSettingsClick]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={onClose} />

      {/* Drawer */}
      <div
        className={cn(
          "fixed top-0 right-0 z-50 h-full w-72 lg:hidden",
          "bg-brown/95 backdrop-blur-md border-l border-gold/30",
          "transform transition-transform duration-300 ease-out",
          isOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gold/20">
          <span className="text-lg font-semibold text-gold">Menu</span>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gold/60 hover:text-gold hover:bg-gold/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="px-3 py-4 space-y-1">
          {mobileNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                  isActive ? "bg-gold/20 text-gold" : "text-gold/70 hover:bg-gold/10 hover:text-gold",
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Divider */}
        <div className="mx-4 border-t border-gold/20" />

        {/* Settings */}
        <div className="px-3 py-4">
          <button
            onClick={handleSettingsClick}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
              "text-gold/70 hover:bg-gold/10 hover:text-gold",
            )}
          >
            <Settings className="w-5 h-5" />
            <span className="font-medium">Settings</span>
          </button>
        </div>
      </div>
    </>
  );
};

/**
 * Top navigation header with dynamic submenu based on active sidebar section.
 */
export const LandingHeader = ({ walletButton, onSettingsClick, className }: LandingHeaderProps) => {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const activeSection = getSectionFromPath(location.pathname);
  const currentTab = searchParams.get("tab");
  const activeSubItem = getActiveSubItem(activeSection, currentTab);

  const handleSubItemClick = (tab: string | null) => {
    if (tab === null) {
      // Remove tab param for default tab
      setSearchParams({});
    } else {
      setSearchParams({ tab });
    }
  };

  const handleOpenMobileMenu = useCallback(() => {
    setMobileMenuOpen(true);
  }, []);

  const handleCloseMobileMenu = useCallback(() => {
    setMobileMenuOpen(false);
  }, []);

  return (
    <>
      <header
        className={cn(
          "fixed top-0 left-0 right-0 z-30",
          "flex items-center justify-between px-6 py-4",
          "bg-gradient-to-b from-black/60 to-transparent",
          // Add left padding on desktop to account for sidebar
          "lg:pl-20",
          className,
        )}
      >
        {/* Logo - visible on mobile, hidden on desktop (shown in sidebar) */}
        <div className="flex items-center gap-3 lg:hidden">
          <NavLink to="/" className="transition-transform duration-200 hover:scale-105">
            <RealmsLogo className="h-8 w-8 text-gold" />
          </NavLink>
        </div>

        {/* Desktop navigation - dynamic submenu based on active section */}
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main navigation">
          {activeSection.subMenu.map((item) => {
            const isActive = activeSubItem.id === item.id;

            return (
              <button
                key={item.id}
                onClick={() => handleSubItemClick(item.tab)}
                className={cn(
                  "relative px-4 py-2 text-sm font-medium uppercase tracking-wider",
                  "transition-all duration-200",
                  "hover:text-gold",
                  isActive ? "text-gold" : "text-gold/50",
                  // Underline effect on hover and active
                  "after:absolute after:bottom-0 after:left-1/2 after:h-0.5 after:w-0 after:-translate-x-1/2",
                  "after:bg-gold after:transition-all after:duration-200",
                  "hover:after:w-1/2",
                  isActive && "after:w-3/4 after:shadow-[0_0_8px_rgba(223,170,84,0.5)]",
                )}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Spacer for centering on desktop */}
        <div className="hidden flex-1 lg:block" />

        {/* Right side: Wallet + Hamburger (mobile) */}
        <div className="flex items-center gap-2">
          {walletButton}

          {/* Hamburger menu button - mobile only */}
          <button
            onClick={handleOpenMobileMenu}
            className={cn(
              "p-2 rounded-lg lg:hidden",
              "text-gold/70 hover:text-gold hover:bg-gold/10",
              "transition-colors",
            )}
            aria-label="Open menu"
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>
      </header>

      {/* Mobile menu drawer */}
      <MobileMenuDrawer isOpen={mobileMenuOpen} onClose={handleCloseMobileMenu} onSettingsClick={onSettingsClick} />
    </>
  );
};
