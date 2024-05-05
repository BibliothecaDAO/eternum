import { ClientComponents } from "@/dojo/createClientComponents";
import Button from "@/ui/elements/Button";
import { getRealm } from "@/ui/utils/realms";

export const RealmViewCard = ({
  realm,
  onPillage,
  onSiege,
  self,
}: {
  realm: ClientComponents["Realm"]["schema"];
  onPillage: () => void;
  onSiege: () => void;
  self: boolean;
}) => {
  const realmData = getRealm(BigInt(realm.realm_id));
  return (
    <div className="border p-2">
      <h4 className="mb-4">
        {realmData?.name} -{realm.realm_id.toString()}
      </h4>

      {!self && (
        <div className="flex">
          <Button variant="primary" onClick={() => onPillage()}>
            Pillage
          </Button>
          <Button variant="primary" onClick={() => onSiege()}>
            Attack
          </Button>
        </div>
      )}
    </div>
  );
};
