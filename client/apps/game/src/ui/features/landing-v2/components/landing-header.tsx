import { ReactComponent as RealmsLogo } from "@/assets/icons/rw-logo.svg";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { NavLink, useLocation, useSearchParams } from "react-router-dom";
import { getSectionFromPath, getActiveSubItem } from "../context/navigation-config";

interface LandingHeaderProps {
  walletButton?: React.ReactNode;
  className?: string;
}

/**
 * Top navigation header with dynamic submenu based on active sidebar section.
 */
export const LandingHeader = ({ walletButton, className }: LandingHeaderProps) => {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

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

  return (
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

      {/* Wallet button */}
      <div className="flex items-center gap-4">{walletButton}</div>
    </header>
  );
};
