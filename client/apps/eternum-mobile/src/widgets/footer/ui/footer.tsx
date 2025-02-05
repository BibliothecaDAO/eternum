import { Home, MessageCircle, Settings, ShoppingCart } from "lucide-react";
import { Link } from "wouter";

export const Footer = () => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background border-t">
      <div className="container flex justify-around items-center h-16">
        <Link href="/realm">
          <a className="flex flex-col items-center text-muted-foreground hover:text-foreground">
            <Home size={24} />
            <span className="text-xs">Realm</span>
          </a>
        </Link>

        <Link href="/trade">
          <a className="flex flex-col items-center text-muted-foreground hover:text-foreground">
            <ShoppingCart size={24} />
            <span className="text-xs">Trade</span>
          </a>
        </Link>

        <Link href="/chat">
          <a className="flex flex-col items-center text-muted-foreground hover:text-foreground">
            <MessageCircle size={24} />
            <span className="text-xs">Chat</span>
          </a>
        </Link>

        <Link href="/settings">
          <a className="flex flex-col items-center text-muted-foreground hover:text-foreground">
            <Settings size={24} />
            <span className="text-xs">Settings</span>
          </a>
        </Link>
      </div>
    </nav>
  );
};
