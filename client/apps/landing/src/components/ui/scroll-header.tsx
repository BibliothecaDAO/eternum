import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";

interface ScrollHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export const ScrollHeader = ({ children, className }: ScrollHeaderProps) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (!headerRef.current) return;
      
      const parentContainer = headerRef.current.parentElement;
      if (!parentContainer) return;

      const scrollPosition = parentContainer.scrollTop;
      setIsScrolled(scrollPosition > 50);
    };

    const parentContainer = headerRef.current?.parentElement;
    if (parentContainer) {
      parentContainer.addEventListener("scroll", handleScroll);
      return () => parentContainer.removeEventListener("scroll", handleScroll);
    }
  }, []);

  return (
    <div
      ref={headerRef}
      className={cn(
        "sticky top-0 z-50 transition-all duration-300",
        isScrolled ? "py-2 bg-background/80 backdrop-blur-sm shadow-sm" : "py-4",
        className
      )}
    >
      {children}
    </div>
  );
}; 