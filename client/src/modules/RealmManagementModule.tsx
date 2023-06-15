import RealmInfoComponent from "../components/cityview/realm/RealmInfoComponent"
import RealmManagementComponent from "../components/cityview/realm/RealmManagementComponent"
import { BaseContainer } from "../containers/BaseContainer"

const RealmManagementModule = () => {
    return (
        <BaseContainer className="h-full !p-0">
            <RealmInfoComponent />
            <RealmManagementComponent />
        </BaseContainer>
    )
}

export default RealmManagementModule