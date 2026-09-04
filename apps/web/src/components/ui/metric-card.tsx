import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/utils/utils";

interface MetricCardProps {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  className?: string;
  valueClassName?: string;
}

export function MetricCard({ label, value, hint, className, valueClassName }: MetricCardProps) {
  return (
    <Card className={cn("h-full", className)}>
      <CardContent className="space-y-1 p-4">
        <p className="text-muted-foreground text-sm">{label}</p>
        <div className={cn("realm-stat text-2xl font-bold", valueClassName)}>{value}</div>
        {hint ? <p className="text-muted-foreground text-sm">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
