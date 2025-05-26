import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { socials } from "@/data/socials";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { useQuery } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { getLordsInfo } from "@/lib/getLordsPrice";
import { useNavigate } from "@tanstack/react-router";

export function TopBar() {
  const [time, setTime] = useState(new Date());
  const navigate = useNavigate();

  const { data: lordsInfo } = useQuery(
    queryOptions({
      queryKey: ["lordsPrice"],
      queryFn: getLordsInfo,
    })
  );

  const lordsPrice = lordsInfo?.price?.rate;

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleTitleClick = () => {
    navigate({ to: "/" });
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50">
      <div className="mx-2 sm:mx-4 mt-2 sm:mt-4">
        <Card className="backdrop-blur-md">
          <CardContent className="py-2 sm:py-4">
            <div className="container mx-auto flex items-center justify-between px-2 sm:px-4">
              <div className="flex items-center space-x-2 sm:space-x-8">
                <h1
                  className="text-xl sm:text-2xl font-bold cursor-pointer text-primary transition-colors"
                  onClick={handleTitleClick}
                >
                  <img
                    src="/rw-logo.svg"
                    alt="Realms.World"
                    className="w-14 sm:w-18"
                  />
                </h1>
                <div className="hidden sm:flex items-center space-x-2 text-muted-foreground">
                  <span className="text-xs sm:text-sm">
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
                    <span className="text-xs sm:text-sm">LORDS:</span>
                    <span className="text-xs sm:text-sm">
                      ${lordsPrice?.toLocaleString()}
                    </span>
                  </motion.div>
                  <ModeToggle />
                </div>
              </div>

              <div className="flex items-center space-x-2 sm:space-x-6">
                {/* Social Links */}
                <div className="hidden sm:flex items-center space-x-4">
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
                        className="w-5 h-5 fill-current"
                        aria-hidden="true"
                      >
                        <path d={social.icon} />
                      </svg>
                      <span className="sr-only">{social.name}</span>
                    </a>
                  ))}
                </div>
                <span className="hidden sm:block h-6 w-px bg-border" />

                {/* Auth Buttons */}
                <div className="flex items-center space-x-2 sm:space-x-4">
                  <a
                    href="https://account.realms.world/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button size="sm" className="cursor-pointer">
                      Log In
                    </Button>
                  </a>
                  <ModeToggle />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
