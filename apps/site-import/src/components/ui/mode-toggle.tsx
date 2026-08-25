import { Moon } from "lucide-react";

import { Button } from "@/components/ui/button";

export function ModeToggle() {
  return (
    <Button variant="outline" size="icon" disabled aria-label="Dark mode enabled">
      <Moon className="h-[1.2rem] w-[1.2rem]" />
      <span className="sr-only">Dark mode enabled</span>
    </Button>
  );
}
