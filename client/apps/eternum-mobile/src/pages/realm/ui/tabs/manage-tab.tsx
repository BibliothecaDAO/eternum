import { Card, CardContent } from "@/shared/ui/card";

export interface ManageTabProps {
  className?: string;
}

export function ManageTab({ className }: ManageTabProps) {
  return (
    <Card className={className}>
      <CardContent className="p-4">
        <h3 className="text-lg font-semibold mb-4">Realm Management</h3>
        {/* Management content will be added here */}
      </CardContent>
    </Card>
  );
}
