import useRealmStore from "@/hooks/store/useRealmStore";
import { EntityResourceTable } from "../resources/EntityResourceTable";

export const BankEntityList = ({ entityId }: any) => {
  // TODO: Replace with bank entity id
  let { realmEntityId } = useRealmStore();
  return <EntityResourceTable entityId={realmEntityId} />;
};
