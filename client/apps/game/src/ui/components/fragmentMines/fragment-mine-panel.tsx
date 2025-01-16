import { useDojo } from "@/hooks/context/dojo-context";
import Button from "@/ui/elements/button";
import TextInput from "@/ui/elements/text-input";
import { getAddressNameFromEntity } from "@/utils/entities";
import { MAX_NAME_LENGTH } from "@bibliothecadao/eternum";
import { useState } from "react";

export const FragmentMinePanel = ({ entity }: any) => {
  const {
    account: { account },
    setup: { components },
    network: { provider },
  } = useDojo();

  const [isLoading, setIsLoading] = useState(false);
  const [editName, setEditName] = useState(false);
  const [naming, setNaming] = useState("");

  const ownerName = getAddressNameFromEntity(entity.entity_id, components);

  return (
    <div className="flex flex-col h-[50vh] justify-between">
      <div className="flex flex-col mb-2">
        <div className="flex flex-row justify-between items-baseline">
          {editName ? (
            <div className="flex space-x-2">
              <TextInput
                placeholder="Type Name"
                className="h-full"
                onChange={(name) => setNaming(name)}
                maxLength={MAX_NAME_LENGTH}
              />
              <Button
                variant="default"
                isLoading={isLoading}
                onClick={async () => {
                  setIsLoading(true);

                  try {
                    await provider.set_entity_name({ signer: account, entity_id: entity.entity_id, name: naming });
                  } catch (e) {
                    console.error(e);
                  }

                  setIsLoading(false);
                  setEditName(false);
                }}
              >
                Change Name
              </Button>
            </div>
          ) : (
            <h3 className="truncate pr-5">{entity.name}</h3>
          )}

          {account.address === entity.owner && (
            <>
              <Button size="xs" variant="default" onClick={() => setEditName(!editName)}>
                edit name
              </Button>
            </>
          )}
        </div>

        <div className=" align-text-bottom">Owner: {ownerName ? ownerName : "Mercenaries"}</div>
      </div>
    </div>
  );
};
