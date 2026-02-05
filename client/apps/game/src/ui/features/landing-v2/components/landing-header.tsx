import { ReactComponent as BlitzLogo } from "@/assets/icons/blitz-words-logo-g.svg";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { NavLink } from "react-router-dom";

interface NavItem {
  label: string;
  path: string;
}

const navItems: NavItem[] = [
  { label: "Play", path: "/" },
  { label: "Profile", path: "/profile" },
  { label: "Markets", path: "/markets" },
  { label: "Leaderboard", path: "/leaderboard" },
];

interface LandingHeaderProps {
  /** Wallet button for mobile - hidden on desktop (shown in sidebar) */
  mobileWalletButton?: React.ReactNode;
  className?: string;
}

/**
 * Minimal top navigation header with nav items.
 * Wallet is shown in sidebar on desktop, in header on mobile.
 */
export const LandingHeader = ({ mobileWalletButton, className }: LandingHeaderProps) => {
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
          <BlitzLogo className="h-8 w-auto text-gold" />
        </NavLink>
      </div>

      {/* Desktop navigation */}
      <nav className="hidden items-center gap-1 lg:flex" aria-label="Main navigation">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === "/"}
            className={({ isActive }) =>
              cn(
                "relative px-4 py-2 text-sm font-medium uppercase tracking-wider",
                "transition-all duration-200",
                "hover:text-gold",
                isActive ? "text-gold" : "text-gold/50",
                // Underline effect on hover and active
                "after:absolute after:bottom-0 after:left-1/2 after:h-0.5 after:w-0 after:-translate-x-1/2",
                "after:bg-gold after:transition-all after:duration-200",
                "hover:after:w-1/2",
                isActive && "after:w-3/4 after:shadow-[0_0_8px_rgba(223,170,84,0.5)]",
              )
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Spacer for centering on desktop */}
      <div className="hidden flex-1 lg:block" />

      {/* Wallet button - mobile only, desktop shows in sidebar */}
      <div className="flex items-center gap-4 lg:hidden">{mobileWalletButton}</div>

      {/* Empty div to balance header on desktop */}
      <div className="hidden lg:block" />
    </header>
  );
};
