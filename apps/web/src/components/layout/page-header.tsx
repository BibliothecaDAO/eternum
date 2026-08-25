import type { ReactNode } from "react";
import { cn } from "@/utils/utils";

interface PageHeaderProps {
  title: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  eyebrow,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between",
        className,
      )}
    >
      <div className="space-y-2">
        {eyebrow ? <p className="realm-eyebrow">{eyebrow}</p> : null}
        <h1 className="realm-page-title text-3xl sm:text-4xl">{title}</h1>
        {description ? (
          <p className="text-muted-foreground text-sm sm:text-base">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
