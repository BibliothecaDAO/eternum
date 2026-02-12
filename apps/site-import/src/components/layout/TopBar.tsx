import { useEffect, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { useNavigate, Link, useLocation } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { Menu } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function TopBar() {
  const [isScrolled, setIsScrolled] = useState(false);
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

  const pageSections =
    location.pathname === "/"
      ? [
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
        ]
      : [];
  const railSections = pageSections.filter((section) => section.id !== "hero");

  const scrollToSection = (href: string) => {
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
                  className="text-xs uppercase tracking-[0.15em] text-foreground/75 hover:text-primary transition-colors"
                  activeProps={{
                    className: "text-primary",
                  }}
                >
                  Games
                </Link>
                <Link
                  to="/scroll"
                  className="text-xs uppercase tracking-[0.15em] text-foreground/75 hover:text-primary transition-colors"
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
                        variant="ghost"
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

                <ModeToggle />
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {railSections.length > 0 ? (
        <aside
          aria-label="Section rail navigation"
          className="fixed right-3 top-1/2 -translate-y-1/2 z-40 hidden lg:flex flex-col gap-2"
        >
          {railSections.map((section) => (
            <button
              key={section.id}
              onClick={() => scrollToSection(section.href)}
              className="rounded-md border border-primary/25 bg-black/45 px-3 py-2 text-[11px] uppercase tracking-[0.16em] text-foreground/80 hover:text-primary hover:border-primary/60 transition-colors text-right"
            >
              {section.label}
            </button>
          ))}
        </aside>
      ) : null}
    </motion.header>
  );
}
