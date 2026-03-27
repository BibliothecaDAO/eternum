import { ID, RealmInfo } from "@bibliothecadao/types";

const findRealmById = (realms: RealmInfo[], realmId?: ID) => {
  if (realmId === undefined || realmId === null) {
    return undefined;
  }

  return realms.find((realm) => realm.entityId === realmId);
};

export const resolveInitialSelectedRealm = ({
  realms,
  preSelectedRealmId,
  currentStructureEntityId,
}: {
  realms: RealmInfo[];
  preSelectedRealmId?: ID;
  currentStructureEntityId?: ID;
}) => {
  return findRealmById(realms, preSelectedRealmId) ?? findRealmById(realms, currentStructureEntityId) ?? realms[0];
};

export const resolveSelectedRealm = ({
  realms,
  realmId,
  fallbackRealm,
}: {
  realms: RealmInfo[];
  realmId?: ID;
  fallbackRealm?: RealmInfo;
}) => {
  return findRealmById(realms, realmId) ?? fallbackRealm;
};
