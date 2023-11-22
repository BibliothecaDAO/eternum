import RealmInfoComponent from "../components/cityview/realm/RealmInfoComponent";
import RealmManagementComponent from "../components/cityview/realm/RealmManagementComponent";
import { BaseContainer } from "../containers/BaseContainer";

const RealmManagementModule = () => {
  return (
    <BaseContainer className="max-h-full h-min !p-0 mt-2">
      <RealmInfoComponent />
      <RealmManagementComponent />
    </BaseContainer>
  );
};

export default RealmManagementModule;
