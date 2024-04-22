import useRealmStore from "@/hooks/store/useRealmStore";
import { EntityResourceTable } from "../resources/EntityResourceTable";

export const BankEntityList = ({ entity }: any) => {
  return <EntityResourceTable entityId={entity.id} />;
};
