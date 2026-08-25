import type { VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/utils/utils";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";

const buttonVariants = cva(
  "focus-visible:ring-ring inline-flex items-center justify-center gap-2 rounded-lg border border-transparent px-4 text-sm font-semibold [letter-spacing:var(--tracking-ui)] whitespace-nowrap uppercase transition-[background-color,border-color,color,box-shadow,transform] focus-visible:ring-2 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground border-realm-etched shadow-[0_12px_24px_color-mix(in_oklab,var(--realm-accent-brass)_24%,transparent)] hover:-translate-y-0.5 hover:bg-[color:var(--realm-accent-ember)]",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-xs",
        outline:
          "bg-card/80 text-foreground hover:bg-accent/70 hover:text-primary border-realm-etched shadow-[inset_0_1px_0_color-mix(in_oklab,white_8%,transparent),0_10px_24px_color-mix(in_oklab,black_24%,transparent)] hover:border-[color:var(--realm-accent-brass)]",
        secondary: "bg-secondary/80 text-secondary-foreground hover:bg-secondary border-realm-etched shadow-xs",
        ghost:
          "text-foreground hover:bg-accent/60 hover:text-primary border-transparent bg-transparent hover:border-realm-etched",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-11 rounded-lg px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
