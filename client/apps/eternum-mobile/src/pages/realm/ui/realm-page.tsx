import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

export const RealmPage = () => {
  return (
    <div className="container p-4">
      <Card>
        <CardHeader>
          <CardTitle>Realm Overview</CardTitle>
        </CardHeader>
        <CardContent>{/* Realm content will go here */}</CardContent>
      </Card>
    </div>
  );
};
