import { Card, CardContent } from "@/shared/ui/card";

export interface ClaimTabProps {
  className?: string;
}

export function ClaimTab({ className }: ClaimTabProps) {
  return (
    <Card className={className}>
      <CardContent className="p-4">
        <h3 className="text-lg font-semibold mb-4">Claim Realm</h3>
        {/* Claim content will be added here */}
      </CardContent>
    </Card>
  );
}
