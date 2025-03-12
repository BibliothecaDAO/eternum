import { Card, CardContent } from "@/shared/ui/card";

export interface MilitaryTabProps {
  className?: string;
}

export function MilitaryTab({ className }: MilitaryTabProps) {
  return (
    <Card className={className}>
      <CardContent className="p-4">
        <h3 className="text-lg font-semibold mb-4">Military</h3>
        {/* Military content will be added here */}
      </CardContent>
    </Card>
  );
}
