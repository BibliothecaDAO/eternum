import { ROUTES } from "@/shared/consts/routes";
import { Link, useMatches } from "@tanstack/react-router";
import { Home, MessageCircle, Settings, ShoppingCart } from "lucide-react";

export const Footer = () => {
  const matches = useMatches();
  const currentPath = matches.at(-1)?.pathname;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background border-t">
      <div className="container flex justify-around items-center h-16">
        <Link
          to={ROUTES.REALM}
          className={`flex flex-col items-center ${
            currentPath === ROUTES.REALM ? "text-foreground" : "text-muted-foreground"
          } hover:text-foreground`}
        >
          <Home size={24} />
          <span className="text-xs">Realm</span>
        </Link>

        <Link
          to={ROUTES.TRADE}
          search={{
            buyResourceId: undefined,
            sellResourceId: undefined,
          }}
          className={`flex flex-col items-center ${
            currentPath === ROUTES.TRADE ? "text-foreground" : "text-muted-foreground"
          } hover:text-foreground`}
        >
          <ShoppingCart size={24} />
          <span className="text-xs">Trade</span>
        </Link>

        <Link
          to={ROUTES.CHAT}
          className={`flex flex-col items-center ${
            currentPath === ROUTES.CHAT ? "text-foreground" : "text-muted-foreground"
          } hover:text-foreground`}
        >
          <MessageCircle size={24} />
          <span className="text-xs">Chat</span>
        </Link>

        <Link
          to={ROUTES.SETTINGS}
          className={`flex flex-col items-center ${
            currentPath === ROUTES.SETTINGS ? "text-foreground" : "text-muted-foreground"
          } hover:text-foreground`}
        >
          <Settings size={24} />
          <span className="text-xs">Settings</span>
        </Link>
      </div>
    </nav>
  );
};
