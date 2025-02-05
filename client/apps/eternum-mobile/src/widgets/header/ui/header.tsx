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
import { useState } from "react";
import { Link, useLocation } from "wouter";

const navigation = [
  { name: "Overview", href: "/overview" },
  { name: "Settings", href: "/settings" },
];

export function Header() {
  const [location, setLocation] = useLocation();
  const [open, setOpen] = useState(false);

  const handleLogout = () => {
    setOpen(false);
    setLocation("/");
  };

  return (
    <header className="border-b px-2">
      <div className="container flex h-14 items-center">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              className="mr-2 px-0 text-base hover:bg-transparent focus-visible:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 lg:hidden"
            >
              <svg
                strokeWidth="1.5"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
              >
                <path
                  d="M3 5H11"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M3 12H16"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M3 19H21"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="sr-only">Toggle Menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left">
            <SheetHeader>
              <SheetTitle>Eternum</SheetTitle>
              <SheetDescription>Where do you want to go?</SheetDescription>
            </SheetHeader>
            <nav className="flex flex-col space-y-4 py-4">
              {navigation.map((item) => (
                <Link key={item.href} href={item.href}>
                  <a
                    className={`block px-2 py-1 text-lg ${
                      location === item.href ? "font-medium text-foreground" : "text-muted-foreground"
                    }`}
                    onClick={() => setOpen(false)}
                  >
                    {item.name}
                  </a>
                </Link>
              ))}
            </nav>
            <SheetFooter>
              <Button onClick={handleLogout}>Logout</Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
        <div className="mr-4 hidden lg:flex">
          <nav className="flex items-center space-x-6 text-sm font-medium">
            {navigation.map((item) => (
              <Link key={item.href} href={item.href}>
                <a className={location === item.href ? "text-foreground" : "text-muted-foreground"}>{item.name}</a>
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
