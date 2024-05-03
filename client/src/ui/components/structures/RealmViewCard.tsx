import { ClientComponents } from "@/dojo/createClientComponents";
import Button from "@/ui/elements/Button";

export const RealmViewCard = ({
  realm,
  onPillage,
  onSiege,
}: {
  realm: ClientComponents["Realm"]["schema"];
  onPillage: () => void;
  onSiege: () => void;
}) => {
  return (
    <div className="border p-4">
      <div className="h4">Realm: {realm.realm_id.toString()}</div>

      <div>
        <Button onClick={() => onPillage()}>Pillage</Button>
        <Button onClick={() => onSiege()}>Attack</Button>
      </div>
    </div>
  );
};
