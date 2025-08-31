import { ROUTES } from "@/shared/consts/routes";
import { Link, useMatches } from "@tanstack/react-router";
import { Home, Map, MessageCircle, Settings } from "lucide-react";

export const Footer = () => {
  const matches = useMatches();
  const currentPath = matches.at(-1)?.pathname;

  return (
    <nav className="fixed bottom-2 left-2 right-2 bg-background/95 backdrop-blur-md border border-border/50 rounded-2xl shadow-lg safe-area-pb">
      <div className="flex justify-center items-center h-16 px-4 gap-2">
        <Link
          to={ROUTES.HOME}
          className={`flex flex-col items-center justify-center min-w-0 flex-1 py-2 rounded-xl transition-all duration-200 ${
            currentPath === ROUTES.HOME
              ? "text-primary bg-primary/10"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          }`}
        >
          <Home size={22} className="mb-1" />
          <span className="text-xs font-medium">Home</span>
        </Link>

        <Link
          to={ROUTES.WORLDMAP}
          className={`flex flex-col items-center justify-center min-w-0 flex-1 py-2 rounded-xl transition-all duration-200 ${
            currentPath === ROUTES.WORLDMAP
              ? "text-primary bg-primary/10"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          }`}
        >
          <Map size={22} className="mb-1" />
          <span className="text-xs font-medium">Worldmap</span>
        </Link>

        <Link
          to={ROUTES.CHAT}
          className={`flex flex-col items-center justify-center min-w-0 flex-1 py-2 rounded-xl transition-all duration-200 ${
            currentPath === ROUTES.CHAT
              ? "text-primary bg-primary/10"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          }`}
        >
          <MessageCircle size={22} className="mb-1" />
          <span className="text-xs font-medium">Chat</span>
        </Link>

        <Link
          to={ROUTES.SETTINGS}
          className={`flex flex-col items-center justify-center min-w-0 flex-1 py-2 rounded-xl transition-all duration-200 ${
            currentPath === ROUTES.SETTINGS
              ? "text-primary bg-primary/10"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          }`}
        >
          <Settings size={22} className="mb-1" />
          <span className="text-xs font-medium">Settings</span>
        </Link>
      </div>
    </nav>
  );
};
