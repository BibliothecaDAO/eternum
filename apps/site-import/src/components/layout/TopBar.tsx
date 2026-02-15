import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useNavigate, Link, useLocation } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { HEADER_SCROLL_OFFSET } from "@/lib/constants";
import {
  Bot,
  Coins,
  Compass,
  Handshake,
  Menu,
  Github,
  type LucideIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const homeSections = [
  { id: "hero", label: "Home", href: "#" },
  { id: "agent-native", label: "Agents", href: "#agent-native" },
  { id: "games", label: "Games", href: "#games" },
  { id: "economics", label: "Economics", href: "#economics" },
  { id: "partners", label: "Partners", href: "#partners" },
];

const railIcons: Record<string, LucideIcon> = {
  "agent-native": Bot,
  games: Compass,
  economics: Coins,
  partners: Handshake,
};

function DeferredHeaderApyValue() {
  const [ApyValue, setApyValue] = useState<ComponentType | null>(null);

  useEffect(() => {
    let mounted = true;

    import("@/components/sections/FooterApyValue").then((module) => {
      if (!mounted) return;
      setApyValue(() => module.FooterApyValue);
    });

    return () => {
      mounted = false;
    };
  }, []);

  return <>{ApyValue ? <ApyValue /> : "12.5%"}</>;
}

export function TopBar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("hero");
  const [isRailExpanded, setIsRailExpanded] = useState(false);
  const activeSectionTimeoutRef = useRef<number | null>(null);
  const railExpandTimeoutRef = useRef<number | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleTitleClick = () => {
    navigate({ to: "/" });
  };

  const pageSections = useMemo(
    () => (location.pathname === "/" ? homeSections : []),
    [location.pathname]
  );
  const railSections = useMemo(
    () => pageSections.filter((section) => section.id !== "hero"),
    [pageSections]
  );

  const scheduleActiveSection = useCallback(
    (nextSection: string, immediate = false) => {
      if (activeSectionTimeoutRef.current !== null) {
        window.clearTimeout(activeSectionTimeoutRef.current);
        activeSectionTimeoutRef.current = null;
      }

      if (immediate) {
        setActiveSection(nextSection);
        return;
      }

      activeSectionTimeoutRef.current = window.setTimeout(() => {
        setActiveSection(nextSection);
        activeSectionTimeoutRef.current = null;
      }, 95);
    },
    []
  );

  const scheduleRailExpanded = useCallback((nextExpanded: boolean) => {
    if (railExpandTimeoutRef.current !== null) {
      window.clearTimeout(railExpandTimeoutRef.current);
      railExpandTimeoutRef.current = null;
    }

    railExpandTimeoutRef.current = window.setTimeout(() => {
      setIsRailExpanded(nextExpanded);
      railExpandTimeoutRef.current = null;
    }, nextExpanded ? 80 : 120);
  }, []);

  useEffect(() => {
    return () => {
      if (activeSectionTimeoutRef.current !== null) {
        window.clearTimeout(activeSectionTimeoutRef.current);
        activeSectionTimeoutRef.current = null;
      }
      if (railExpandTimeoutRef.current !== null) {
        window.clearTimeout(railExpandTimeoutRef.current);
        railExpandTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (pageSections.length === 0) return;

    const sectionsToObserve = pageSections
      .map((section) => document.getElementById(section.id))
      .filter((section): section is HTMLElement => section !== null);

    if (sectionsToObserve.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (a, b) =>
              b.intersectionRatio - a.intersectionRatio ||
              a.boundingClientRect.top - b.boundingClientRect.top
          );

        if (visibleEntries.length === 0) {
          if (window.scrollY < 100) {
            scheduleActiveSection("hero");
          }
          return;
        }

        const [topEntry] = visibleEntries;
        scheduleActiveSection(topEntry.target.id);
      },
      {
        rootMargin: "-24% 0px -52% 0px",
        threshold: [0.15, 0.35, 0.55, 0.75],
      }
    );

    sectionsToObserve.forEach((section) => observer.observe(section));

    return () => observer.disconnect();
  }, [pageSections, scheduleActiveSection]);

  const scrollToSection = (href: string) => {
    const sectionId = href === "#" ? "hero" : href.replace("#", "");
    scheduleActiveSection(sectionId, true);

    if (href === "#") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const element = document.getElementById(sectionId);
    if (!element) return;

    const elementPosition = element.getBoundingClientRect().top;
    const offsetPosition = elementPosition + window.pageYOffset - HEADER_SCROLL_OFFSET;

    window.scrollTo({
      top: offsetPosition,
      behavior: "smooth",
    });
  };

  return (
    <motion.header
      className="fixed top-0 left-0 right-0 z-50"
    >
      <div
        className={cn(
          "transition-all duration-300",
          isScrolled
            ? "realm-header-shell border-b border-primary/25 bg-black/45 backdrop-blur-xl supports-[backdrop-filter]:bg-black/35"
            : "bg-transparent border-b border-transparent"
        )}
      >
        <div className={cn("transition-all duration-300", isScrolled ? "py-2" : "py-3.5 sm:py-4")}>
          <div className="container mx-auto px-3 sm:px-4">
            <div className="flex items-center justify-between gap-2 sm:gap-4">
              <button
                className="flex items-center gap-2 sm:gap-3 text-left"
                onClick={handleTitleClick}
                aria-label="Go to homepage"
              >
                <img
                  src="/rw-logo.svg"
                  alt="Realms.World"
                  className={cn(
                    "transition-all duration-300",
                    isScrolled ? "w-10 sm:w-11" : "w-11 sm:w-13"
                  )}
                />
              </button>

              <nav className="hidden xl:flex items-center gap-3">
                <Link
                  to="/games"
                  className="realm-nav-link text-xs uppercase tracking-[0.15em] text-foreground/75 hover:text-primary transition-colors"
                  activeProps={{
                    className: "text-primary",
                  }}
                >
                  Games
                </Link>
                <Link
                  to="/eternum"
                  className="realm-nav-link text-xs uppercase tracking-[0.15em] text-foreground/75 hover:text-primary transition-colors"
                  activeProps={{
                    className: "text-primary",
                  }}
                >
                  Eternum
                </Link>
                <Link
                  to="/blitz"
                  className="realm-nav-link text-xs uppercase tracking-[0.15em] text-foreground/75 hover:text-primary transition-colors"
                  activeProps={{
                    className: "text-primary",
                  }}
                >
                  Blitz
                </Link>
                <Link
                  to="/scroll"
                  className="realm-nav-link text-xs uppercase tracking-[0.15em] text-foreground/75 hover:text-primary transition-colors"
                  activeProps={{
                    className: "text-primary",
                  }}
                >
                  Scroll
                </Link>
              </nav>

              <div className="flex items-center gap-2 sm:gap-3">
                {/* Mobile nav menu — visible below xl */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="rune"
                      size="sm"
                      className="xl:hidden px-2"
                      aria-label="Open navigation menu"
                    >
                      <Menu className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem asChild>
                      <Link to="/games" className="w-full">Games</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/eternum" className="w-full">Eternum</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/blitz" className="w-full">Blitz</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/scroll" className="w-full">Scroll</Link>
                    </DropdownMenuItem>

                    {pageSections.length > 0 && (
                      <>
                        <DropdownMenuSeparator />
                        {pageSections.map((section) => (
                          <DropdownMenuItem
                            key={section.id}
                            onSelect={(event) => {
                              event.preventDefault();
                              scrollToSection(section.href);
                            }}
                          >
                            {section.label}
                          </DropdownMenuItem>
                        ))}
                      </>
                    )}

                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <a href="https://account.realms.world" target="_blank" rel="noopener noreferrer" className="w-full">
                        Account
                      </a>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <a href="https://twitter.com/LordsRealms" target="_blank" rel="noopener noreferrer" className="w-full">
                        Twitter
                      </a>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <a href="https://discord.gg/realmsworld" target="_blank" rel="noopener noreferrer" className="w-full">
                        Discord
                      </a>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <a href="https://github.com/BibliothecaDAO" target="_blank" rel="noopener noreferrer" className="w-full">
                        GitHub
                      </a>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Social links — desktop only (in mobile menu above) */}
                <div className="hidden xl:flex items-center gap-1">
                  <a
                    href="https://twitter.com/LordsRealms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-foreground/50 hover:text-primary hover:bg-primary/10 transition-colors"
                    aria-label="Twitter"
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                  </a>
                  <a
                    href="https://discord.gg/realmsworld"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-foreground/50 hover:text-primary hover:bg-primary/10 transition-colors"
                    aria-label="Discord"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.947 2.418-2.157 2.418z"/></svg>
                  </a>
                  <a
                    href="https://github.com/BibliothecaDAO"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-foreground/50 hover:text-primary hover:bg-primary/10 transition-colors"
                    aria-label="GitHub"
                  >
                    <Github className="h-3.5 w-3.5" />
                  </a>
                </div>

                <div className="hidden md:inline-flex items-center gap-2 rounded-full border border-primary/25 bg-black/35 px-2.5 py-1">
                  <span className="text-[10px] uppercase tracking-[0.14em] text-foreground/62">
                    veLORDS APY
                  </span>
                  <span className="text-xs font-semibold tabular-nums text-primary">
                    <DeferredHeaderApyValue />
                  </span>
                </div>

                <Button variant="oath" size="sm" asChild>
                  <a href="https://account.realms.world" target="_blank" rel="noopener noreferrer">
                    Account
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {railSections.length > 0 ? (
        <aside
          aria-label="Section rail navigation"
          className={cn(
            "group realm-rail-shell fixed right-3 top-1/2 -translate-y-1/2 z-40 hidden lg:flex flex-col gap-1.5",
            isRailExpanded ? "realm-rail-shell-expanded" : ""
          )}
          onMouseEnter={() => scheduleRailExpanded(true)}
          onMouseLeave={() => scheduleRailExpanded(false)}
          onFocusCapture={() => scheduleRailExpanded(true)}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              scheduleRailExpanded(false);
            }
          }}
        >
          {railSections.map((section) => {
            const Icon = railIcons[section.id] ?? Compass;

            return (
              <button
                key={section.id}
                onClick={() => scrollToSection(section.href)}
                aria-label={`Go to ${section.label} section`}
                aria-current={activeSection === section.id ? "true" : undefined}
                title={section.label}
                className={cn(
                  "group realm-rail-button realm-rail-item realm-holo-card",
                  isRailExpanded ? "realm-rail-item-expanded" : "",
                  activeSection === section.id ? "realm-rail-item-active" : ""
                )}
              >
                <span className="realm-rail-glyph" aria-hidden="true">
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                </span>
                <span
                  className={cn(
                    "realm-rail-label truncate transition-all duration-200",
                    isRailExpanded
                      ? "max-w-[11rem] opacity-100 ml-2"
                      : "max-w-0 opacity-0 ml-0"
                  )}
                >
                  {section.label}
                </span>
              </button>
            );
          })}
        </aside>
      ) : null}
    </motion.header>
  );
}
