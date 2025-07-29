import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";

export const Buildings = () => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Buildings & Bases</CardTitle>
          <CardDescription>Construct your empire</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardContent className="p-6">
          <p className="text-sm leading-relaxed text-muted-foreground text-center">
            Buildings information will be available here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
