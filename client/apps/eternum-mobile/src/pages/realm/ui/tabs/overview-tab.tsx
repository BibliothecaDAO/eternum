import { Card, CardContent } from "@/shared/ui/card";

export interface OverviewTabProps {
  className?: string;
}

export function OverviewTab({ className }: OverviewTabProps) {
  return (
    <Card className={className}>
      <CardContent className="p-4">
        <h3 className="text-lg font-semibold mb-4">Realm Overview</h3>
        {/* Overview content will be added here */}
      </CardContent>
    </Card>
  );
}
