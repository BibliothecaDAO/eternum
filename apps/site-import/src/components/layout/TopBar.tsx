import { useState, useEffect } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { socials } from "@/data/socials";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { useQuery } from "@tanstack/react-query";
import { lordsInfoQueryOptions } from "@/lib/query-options";
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
  const [time, setTime] = useState(new Date());
  const [isScrolled, setIsScrolled] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { scrollY } = useScroll();

  // Transform values for smooth transitions
  const marginTop = useTransform(scrollY, [0, 50], [16, 0]);
  const marginX = useTransform(scrollY, [0, 50], [16, 0]);
  const paddingY = useTransform(scrollY, [0, 50], [16, 8]);

  const { data: lordsInfo } = useQuery(lordsInfoQueryOptions());

  const lordsPrice = lordsInfo?.price?.rate;

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleTitleClick = () => {
    navigate({ to: "/" });
  };

  // Page sections for navigation (only show on homepage)
  const pageSections =
    location.pathname === "/"
      ? [
          { id: "hero", label: "Home", href: "#" },
          { id: "partners", label: "Partners", href: "#partners" },
          { id: "value-flow", label: "Value Flow", href: "#value-flow" },
          { id: "tokenomics", label: "Tokenomics", href: "#tokenomics" },
          { id: "treasury", label: "Treasury", href: "#treasury" },
        ]
      : [];

  const scrollToSection = (href: string) => {
    if (href === "#") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      const element = document.querySelector(href);
      if (element) {
        const offset = 100; // Account for fixed header
        const elementPosition = element.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - offset;

        window.scrollTo({
          top: offsetPosition,
          behavior: "smooth",
        });
      }
    }
  };

  return (
    <motion.div
      className="fixed top-0 left-0 right-0 z-50"
      style={{
        marginTop: isScrolled ? 0 : marginTop,
        marginLeft: isScrolled ? 0 : marginX,
        marginRight: isScrolled ? 0 : marginX,
      }}
    >
      <Card
        className={cn(
          "backdrop-blur-md transition-all duration-300",
          isScrolled ? "rounded-none border-x-0 border-t-0" : ""
        )}
      >
        <motion.div
          style={{
            paddingTop: isScrolled ? 8 : paddingY,
            paddingBottom: isScrolled ? 8 : paddingY,
          }}
        >
          <CardContent className="py-0">
            <div className="container mx-auto px-2 sm:px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 sm:space-x-8">
                  <h1
                    className="cursor-pointer text-primary transition-all"
                    onClick={handleTitleClick}
                  >
                    <img
                      src="/rw-logo.svg"
                      alt="Realms.World"
                      className={cn(
                        "transition-all duration-300",
                        isScrolled ? "w-10 sm:w-12" : "w-14 sm:w-18"
                      )}
                    />
                  </h1>

                  {/* Navigation Links */}
                  <nav className="flex items-center space-x-3 sm:space-x-4">
                    {/* Always show Games link */}
                    <Link
                      to="/games"
                      className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
                      activeProps={{
                        className: "text-primary",
                      }}
                    >
                      Games
                    </Link>
                    <Link
                      to="/scroll"
                      className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
                      activeProps={{
                        className: "text-primary",
                      }}
                    >
                      Scroll
                    </Link>

                    {/* Show section links on homepage */}
                    {pageSections.length > 0 && (
                      <>
                        <span className="h-4 w-px bg-border" />
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
                          <DropdownMenuContent align="start" className="w-44">
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
                        {pageSections.slice(1).map((section) => (
                          <button
                            key={section.id}
                            onClick={() => scrollToSection(section.href)}
                            className={cn(
                              "text-sm font-medium text-muted-foreground hover:text-primary transition-colors",
                              "hidden lg:block"
                            )}
                          >
                            {section.label}
                          </button>
                        ))}
                      </>
                    )}
                  </nav>

                  <div className="hidden sm:flex items-center space-x-2 text-muted-foreground">
                    <span
                      className={cn(
                        "transition-all duration-300",
                        isScrolled ? "text-xs" : "text-xs sm:text-sm"
                      )}
                    >
                      {time.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <span className="h-4 w-px bg-border" />
                    <motion.div
                      className="flex items-center space-x-1"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 }}
                    >
                      <span
                        className={cn(
                          "transition-all duration-300",
                          isScrolled ? "text-xs" : "text-xs sm:text-sm"
                        )}
                      >
                        LORDS:
                      </span>
                      <span
                        className={cn(
                          "transition-all duration-300",
                          isScrolled ? "text-xs" : "text-xs sm:text-sm"
                        )}
                      >
                        ${lordsPrice?.toLocaleString()}
                      </span>
                    </motion.div>
                  </div>
                </div>

                <div className="flex items-center space-x-2 sm:space-x-6">
                  {/* Social Links */}
                  <div
                    className={cn(
                      "items-center space-x-4",
                      isScrolled ? "hidden xl:flex" : "hidden sm:flex"
                    )}
                  >
                    {socials.map((social) => (
                      <a
                        key={social.id}
                        href={social.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-primary transition-colors"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          className={cn(
                            "fill-current transition-all duration-300",
                            isScrolled ? "w-4 h-4" : "w-5 h-5"
                          )}
                          aria-hidden="true"
                        >
                          <path d={social.icon} />
                        </svg>
                        <span className="sr-only">{social.name}</span>
                      </a>
                    ))}
                  </div>
                  <span
                    className={cn(
                      "h-6 w-px bg-border",
                      isScrolled ? "hidden xl:block" : "hidden sm:block"
                    )}
                  />

                  {/* Auth Buttons */}
                  <div className="flex items-center space-x-2 sm:space-x-4">
                    <a
                      href="https://account.realms.world/"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button
                        size="sm"
                        className={cn(
                          "cursor-pointer transition-all duration-300",
                          isScrolled ? "text-xs px-3" : ""
                        )}
                      >
                        Log In
                      </Button>
                    </a>
                    <ModeToggle />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </motion.div>
      </Card>
    </motion.div>
  );
}
