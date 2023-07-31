import RealmInfoComponent from "../components/cityview/realm/RealmInfoComponent";
import RealmManagementComponent from "../components/cityview/realm/RealmManagementComponent";
import { BaseContainer } from "../containers/BaseContainer";
import { Utils } from "@dojoengine/core";
import useRealmStore from "../hooks/store/useRealmStore";
import { Transition } from "@headlessui/react";
import { Fragment } from "react";
import { useGetRealm } from "../hooks/graphql/useGraphQLQueries";

const RealmManagementModule = () => {
  const { realmEntityId } = useRealmStore();

  const { realm } = useGetRealm({ entityId: realmEntityId });
  return (
    <>
      {
        <Transition
          show={realm ? true : false}
          as={Fragment}
          enter="transition-opacity duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="transition-opacity duration-300"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <BaseContainer className="max-h-full h-min !p-0">
            <RealmInfoComponent />
            <RealmManagementComponent />
          </BaseContainer>
        </Transition>
      }
    </>
  );
};

export default RealmManagementModule;
