import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { RealmInfoHeader } from "@/widgets/realm-info-header";
import { RealmLevels } from "@bibliothecadao/eternum";

export const RealmPage = () => {
  return (
    <div className="container p-4 space-y-4">
      <RealmInfoHeader
        realmName="Uw Rohi"
        realmLevel={RealmLevels.Kingdom}
        realmProgress={33}
        balance={1000}
        coordinates={{ x: 10, y: 10 }}
        realmNumber={6132}
      />
      <Card>
        <CardHeader>
          <CardTitle>Realm Overview</CardTitle>
        </CardHeader>
        <CardContent>{/* Realm content will go here */}</CardContent>
      </Card>
    </div>
  );
};
