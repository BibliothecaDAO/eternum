import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

export const TradePage = () => {
  return (
    <div className="container p-4">
      <Card>
        <CardHeader>
          <CardTitle>Trade Center</CardTitle>
        </CardHeader>
        <CardContent>{/* Trade content will go here */}</CardContent>
      </Card>
    </div>
  );
};
