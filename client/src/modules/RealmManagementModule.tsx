import { useComponentValue } from "@dojoengine/react";
import RealmInfoComponent from "../components/cityview/realm/RealmInfoComponent"
import RealmManagementComponent from "../components/cityview/realm/RealmManagementComponent"
import { BaseContainer } from "../containers/BaseContainer"
import { Utils } from "@dojoengine/core";
import useRealmStore from "../hooks/store/useRealmStore";
import { useDojo } from "../DojoContext";
import { Transition } from '@headlessui/react'

const RealmManagementModule = () => {
    const { realmEntityId } = useRealmStore();
    const { components: { Realm } } = useDojo();

    const realm = useComponentValue(Realm, Utils.getEntityIdFromKeys([BigInt(realmEntityId)]));
    return (<>
        {<BaseContainer className="max-h-full h-min !p-0">
            <RealmInfoComponent />
            <RealmManagementComponent />
        </BaseContainer>
        }
    </>)
}

export default RealmManagementModule