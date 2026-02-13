import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useNavigate, Link, useLocation } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import {
  Bot,
  Coins,
  Compass,
  GitBranch,
  Handshake,
  Landmark,
  Menu,
  type LucideIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const homeSections = [
  { id: "hero", label: "Home", href: "#" },
  {
    id: "agent-native",
    label: "Agent Native",
    href: "#agent-native",
  },
  {
    id: "ecosystem-atlas",
    label: "Ecosystem Atlas",
    href: "#ecosystem-atlas",
  },
  { id: "partners", label: "Partners", href: "#partners" },
  { id: "value-flow", label: "Value Flow", href: "#value-flow" },
  { id: "tokenomics", label: "Tokenomics", href: "#tokenomics" },
  { id: "treasury", label: "Treasury", href: "#treasury" },
];

const railIcons: Record<string, LucideIcon> = {
  "agent-native": Bot,
  "ecosystem-atlas": Compass,
  partners: Handshake,
  "value-flow": GitBranch,
  tokenomics: Coins,
  treasury: Landmark,
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
  const { scrollY } = useScroll();

  const marginTop = useTransform(scrollY, [0, 56], [14, 2]);
  const marginX = useTransform(scrollY, [0, 56], [14, 0]);
  const paddingY = useTransform(scrollY, [0, 56], [14, 10]);

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

    const element = document.querySelector(href);
    if (!element) return;

    const offset = 108;
    const elementPosition = element.getBoundingClientRect().top;
    const offsetPosition = elementPosition + window.pageYOffset - offset;

    window.scrollTo({
      top: offsetPosition,
      behavior: "smooth",
    });
  };

  return (
    <motion.header
      className="fixed top-0 left-0 right-0 z-50"
      style={{
        marginTop: isScrolled ? 0 : marginTop,
        marginLeft: isScrolled ? 0 : marginX,
        marginRight: isScrolled ? 0 : marginX,
      }}
    >
      <div
        className={cn(
          "realm-header-shell",
          "border border-primary/25 bg-black/45 backdrop-blur-xl transition-all duration-300",
          "supports-[backdrop-filter]:bg-black/35",
          isScrolled ? "rounded-none border-x-0 border-t-0" : "rounded-2xl"
        )}
      >
        <motion.div
          style={{
            paddingTop: isScrolled ? 8 : paddingY,
            paddingBottom: isScrolled ? 8 : paddingY,
          }}
        >
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
                    isScrolled ? "w-10 sm:w-11" : "w-12 sm:w-14"
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
                {pageSections.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="rune"
                        size="sm"
                        className="lg:hidden px-2"
                        aria-label="Open section navigation"
                      >
                        <Menu className="h-4 w-4" />
                        <span className="ml-1">Sections</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
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
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                <div className="hidden md:inline-flex items-center gap-2 rounded-full border border-primary/25 bg-black/35 px-2.5 py-1">
                  <span className="text-[10px] uppercase tracking-[0.14em] text-foreground/62">
                    veLORDS APY
                  </span>
                  <span className="text-xs font-semibold tabular-nums text-primary">
                    <DeferredHeaderApyValue />
                  </span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
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
