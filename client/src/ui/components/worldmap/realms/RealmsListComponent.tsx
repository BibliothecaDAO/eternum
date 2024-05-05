import { useMemo } from "react";
import { RealmListItem } from "./RealmListItem";
import { useGetRealms } from "../../../../hooks/helpers/useRealm";
import useRealmStore from "../../../../hooks/store/useRealmStore";
import ListSelect from "@/ui/elements/ListSelect";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/ui/elements/Select";

type RealmsListComponentProps = {
  onlyMyRealms?: boolean;
};

export const RealmsListComponent = ({ onlyMyRealms = false }: RealmsListComponentProps) => {
  const realms = useGetRealms();

  const realmEntityIds = useRealmStore((state) => state.realmEntityIds);
  const myRealms = onlyMyRealms ? realmEntityIds.map((realm) => realm.realmEntityId) : [];

  const realmsList = useMemo(() => {
    if (onlyMyRealms) {
      return realms.filter((realm) => myRealms.includes(realm.entity_id));
    } else {
      return realms;
    }
  }, [realms, myRealms]);

  return (
    <>
      <div className="flex flex-col space-y-2 px-2 my-2">
        {realmsList.map((realm) => {
          return <RealmListItem key={realm.entity_id} realm={realm} />;
        })}
      </div>
    </>
  );
};

export const RealmSelect = ({ onlyMyRealms = false }: RealmsListComponentProps) => {
  const realms = useGetRealms();

  const realmEntityIds = useRealmStore((state) => state.realmEntityIds);
  const myRealms = onlyMyRealms ? realmEntityIds.map((realm) => realm.realmEntityId) : [];

  const realmsList = useMemo(() => {
    if (onlyMyRealms) {
      return realms.filter((realm) => myRealms.includes(realm.entity_id));
    } else {
      return realms;
    }
  }, [realms, myRealms]);

  return (
    <Select>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Select a Realm" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {realmsList.map((realm) => {
            return (
              <SelectItem key={realm.entity_id} value={realm.entity_id.toString()}>
                {realm.name}
              </SelectItem>
            );
          })}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
};
