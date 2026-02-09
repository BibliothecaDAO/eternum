import { ROUTES } from "@/shared/consts/routes";
import useStore from "@/shared/store";
import { Button } from "@/shared/ui/button";
import { Drawer, DrawerClose, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/shared/ui/drawer";
import { Label } from "@/shared/ui/label";
import { ModeToggle } from "@/shared/ui/mode-toggle";
import { Separator } from "@/shared/ui/separator";
import { useDisconnect } from "@starknet-react/core";
import { Link, useMatches, useNavigate } from "@tanstack/react-router";
import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left";
import Book from "lucide-react/dist/esm/icons/book";
import Castle from "lucide-react/dist/esm/icons/castle";
import Home from "lucide-react/dist/esm/icons/home";
import LogOut from "lucide-react/dist/esm/icons/log-out";
import Map from "lucide-react/dist/esm/icons/map";
import Menu from "lucide-react/dist/esm/icons/menu";
import MessageCircle from "lucide-react/dist/esm/icons/message-circle";
import Moon from "lucide-react/dist/esm/icons/moon";
import Settings from "lucide-react/dist/esm/icons/settings";
import User from "lucide-react/dist/esm/icons/user";
import { useEffect, useState } from "react";

// Route to title mapping
const routeTitles: Record<string, string> = {
  [ROUTES.REALM]: "Realm",
  [ROUTES.TRADE]: "Trade",
  [ROUTES.CHAT]: "Chat",
  [ROUTES.SETTINGS]: "Settings",
  [ROUTES.LORDPEDIA]: "Lordpedia",
  [ROUTES.WORLDMAP]: "Worldmap",
};

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  currentPath: string;
}

function NavItem({ to, icon, label, currentPath }: NavItemProps) {
  const isActive = currentPath === to;
  return (
    <DrawerClose asChild>
      <Link
        to={to}
        className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
          isActive ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
        }`}
      >
        {icon}
        <span className="font-medium">{label}</span>
      </Link>
    </DrawerClose>
  );
}

export function Header() {
  const matches = useMatches();
  const navigate = useNavigate();
  const { disconnect } = useDisconnect();
  const connector = useStore((state) => state.connector);
  const [userName, setUserName] = useState<string>("adventurer");
  const [menuOpen, setMenuOpen] = useState(false);
  const currentPath = matches.at(-1)?.pathname;

  useEffect(() => {
    if (!connector || !connector!.controller) return;

    try {
      connector.controller.username()?.then((name) => setUserName(name));
    } catch {
      setUserName("adventurer");
    }
  }, [connector]);

  const handleBack = () => {
    window.history.back();
  };

  const handleLogout = () => {
    disconnect();
    setMenuOpen(false);
    navigate({ to: ROUTES.LOGIN });
  };

  const currentTitle = routeTitles[currentPath || ""] || "Eternum";

  if (currentPath === ROUTES.HOME) {
    return null;
  }

  return (
    <header className="border-b px-4 absolute">
      <div className="flex h-14 items-center justify-between relative">
        <Button variant="ghost" size="sm" onClick={handleBack} className="flex items-center space-x-2">
          <ArrowLeft size={16} />
        </Button>

        <h1 className="text-lg font-semibold absolute left-1/2 -translate-x-1/2">{currentTitle}</h1>

        {/* Hamburger Menu */}
        <Drawer open={menuOpen} onOpenChange={setMenuOpen}>
          <DrawerTrigger asChild>
            <Button variant="ghost" size="sm">
              <Menu size={20} />
            </Button>
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle className="flex items-center gap-2">
                <User size={18} />
                <span>{userName}</span>
              </DrawerTitle>
            </DrawerHeader>

            <div className="px-4 pb-4 space-y-1">
              {/* Navigation Links */}
              <NavItem to={ROUTES.HOME} icon={<Home size={20} />} label="Home" currentPath={currentPath || ""} />
              <NavItem to={ROUTES.WORLDMAP} icon={<Map size={20} />} label="Worldmap" currentPath={currentPath || ""} />
              <NavItem to={ROUTES.REALM} icon={<Castle size={20} />} label="Realm" currentPath={currentPath || ""} />
              <NavItem
                to={ROUTES.CHAT}
                icon={<MessageCircle size={20} />}
                label="Chat"
                currentPath={currentPath || ""}
              />
              <NavItem
                to={ROUTES.LORDPEDIA}
                icon={<Book size={20} />}
                label="Lordpedia"
                currentPath={currentPath || ""}
              />

              <Separator className="my-3" />

              {/* Settings Section */}
              <div className="space-y-3 px-4 py-3">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Settings size={18} />
                  <span className="text-sm font-medium">Settings</span>
                </div>

                <div className="flex items-center justify-between pl-7">
                  <div className="flex items-center gap-2">
                    <Moon size={16} />
                    <Label className="text-sm">Theme</Label>
                  </div>
                  <ModeToggle />
                </div>
              </div>

              <Separator className="my-3" />

              {/* Logout */}
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 px-4 py-3 h-auto text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={handleLogout}
              >
                <LogOut size={20} />
                <span className="font-medium">Logout</span>
              </Button>
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    </header>
  );
}
