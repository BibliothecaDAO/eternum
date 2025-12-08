import { RealmInfoPanel } from "@/ui/modules/entity-details/realm/realm-info-panel";

export const EntityDetails = ({ className }: { className?: string }) => {
  return (
    <div className={`h-full ${className}`}>
      <RealmInfoPanel />
    </div>
  );
};
