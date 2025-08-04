import { ROUTES } from "@/shared/consts/routes";
import useStore from "@/shared/store";
import { Button } from "@/shared/ui/button";
import { ModeToggle } from "@/shared/ui/mode-toggle";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/shared/ui/sheet";
import { useDisconnect } from "@starknet-react/core";
import { Link, useMatches, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

const navigation = [
  { name: "Realm", href: ROUTES.REALM },
  { name: "Trade", href: ROUTES.TRADE },
  { name: "Chat", href: ROUTES.CHAT },
  { name: "Settings", href: ROUTES.SETTINGS },
];

export function Header() {
  const navigate = useNavigate();
  const { disconnect } = useDisconnect();
  const [open, setOpen] = useState(false);
  const matches = useMatches();
  const currentPath = matches.at(-1)?.pathname;
  const connector = useStore((state) => state.connector);
  const [userName, setUserName] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!connector || !connector!.controller) return;

    try {
      connector.controller.username()?.then((name) => setUserName(name));
    } catch (error) {
      console.error("Failed to get username:", error);
    }
  }, [connector]);

  const handleLogout = () => {
    setOpen(false);
    disconnect();
    navigate({ to: ROUTES.LOGIN });
  };

  return (
    <header className="border-b px-2">
      <div className="container flex h-14 items-center">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" className="lg:hidden">
              <span className="sr-only">Open menu</span>
              <svg
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </Button>
          </SheetTrigger>
          <SheetContent side="left">
            <SheetHeader>
              <SheetTitle>Eternum</SheetTitle>
              <SheetDescription>Game Navigation</SheetDescription>
            </SheetHeader>
            <nav className="flex flex-col space-y-4 py-4">
              {navigation.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`block px-2 py-1 text-lg ${
                    currentPath === item.href ? "font-medium text-foreground" : "text-muted-foreground"
                  }`}
                  onClick={() => setOpen(false)}
                >
                  {item.name}
                </Link>
              ))}
            </nav>
            <SheetFooter>
              <Button onClick={handleLogout}>Logout ({userName})</Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
        <div className="mr-4 hidden lg:flex">
          <nav className="flex items-center space-x-6 text-sm font-medium">
            {navigation.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className={currentPath === item.href ? "text-foreground" : "text-muted-foreground"}
              >
                {item.name}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex-1">
          <h1 className="text-lg font-semibold">Eternum</h1>
        </div>
        <ModeToggle />
      </div>
    </header>
  );
}
