import { useCallback, useEffect, useMemo, useState } from "react";
import Button from "../../../elements/Button";
import useUIStore from "../../../hooks/store/useUIStore";
import SettleRealmComponent, { MAX_REALMS } from "../../../components/cityview/realm/SettleRealmComponent";
import { useAddressStore } from "../../../hooks/store/useAddressStore";
import { useDojo } from "../../../DojoContext";
import TextInput from "../../../elements/TextInput";
import ListSelect from "../../../elements/ListSelect";
import { addressToNumber, displayAddress } from "../../../utils/utils";
import { ReactComponent as Copy } from "../../../assets/icons/common/copy.svg";
import { ReactComponent as Import } from "../../../assets/icons/common/import.svg";
import { ReactComponent as Cross } from "../../../assets/icons/common/cross.svg";
import { ReactComponent as ArrowRight } from "../../../assets/icons/common/arrow-right.svg";
import { ReactComponent as ArrowLeft } from "../../../assets/icons/common/arrow-left.svg";
import Avatar from "../../../elements/Avatar";
import useRealmStore from "../../../hooks/store/useRealmStore";

import realmsNames from "../../../geodata/realms.json";
import { useLocation } from "wouter";
import { orderNameDict } from "@bibliothecadao/eternum";
import { getRealm } from "../../../utils/realms";
import { Has, HasValue, getComponentValue } from "@dojoengine/recs";
import { RealmBubble } from "../../../components/cityview/RealmSwitch";
import { useEntityQuery } from "@dojoengine/react";
import { useRealm } from "../../../hooks/helpers/useRealm";

export const Onboarding = () => {
  const [currentStep, setCurrentStep] = useState(1);

  const skipOrderSelection = () => setCurrentStep(currentStep + 2);
  const nextStep = () => setCurrentStep(currentStep + 1);
  const prevStep = () => setCurrentStep(currentStep - 1);
  const showBlankOverlay = useUIStore((state) => state.setShowBlankOverlay);

  const step_headings = [
    <span>
      The Age Of Exploration has <span className="text-white">begun</span>....
    </span>,
    "Create Your Leader ",
    "Choose Your Allegiance",
    "",
  ];

  const {
    account: { account },
    setup: {
      components: { Realm, Owner },
    },
  } = useDojo();

  const [_yourRealms, setYourRealms] = useState<RealmBubble[]>([]);

  const { realmId, setRealmId, setRealmEntityId, realmEntityIds, setRealmEntityIds } = useRealmStore();

  const entityIds = useEntityQuery([Has(Realm), HasValue(Owner, { address: BigInt(account.address) })]);

  // set realm entity ids everytime the entity ids change
  useEffect(() => {
    let realmEntityIds = entityIds
      .map((id) => {
        const realm = getComponentValue(Realm, id);
        if (realm) {
          return { realmEntityId: realm.entity_id, realmId: realm?.realm_id };
        }
      })
      .filter(Boolean)
      .sort((a, b) => Number(a!.realmId) - Number(b!.realmId)) as { realmEntityId: bigint; realmId: bigint }[];
    setRealmEntityIds(realmEntityIds);
  }, [entityIds]);

  const [_location, setLocation] = useLocation();

  const realm = useMemo(() => (realmId ? getRealm(realmId) : undefined), [realmId]);

  const realms = useMemo(() => {
    const fetchedYourRealms: RealmBubble[] = [];
    realmEntityIds.forEach(({ realmEntityId, realmId }) => {
      const realm = getRealm(realmId);
      if (!realm) return;
      const name = realmsNames.features[Number(realm.realmId) - 1].name;
      fetchedYourRealms.push({
        id: realmEntityId,
        realmId: realm.realmId,
        name,
        order: orderNameDict[realm.order],
      });
    });
    return fetchedYourRealms;
  }, [realmEntityIds, realm]);

  const canSettle = realmEntityIds.length < MAX_REALMS;

  const handleNamingNext = useCallback(() => {
    if (canSettle) {
      nextStep();
    } else {
      skipOrderSelection();
    }
  }, [canSettle, nextStep, skipOrderSelection]);

  // if on step 3 and can now settle, skip to next
  useEffect(() => {
    if (!canSettle && currentStep === 3) {
      nextStep();
    }
  }, [canSettle, currentStep]);

  useEffect(() => {
    setYourRealms(realms);
  }, [realms]);

  return (
    <div className="relative h-screen w-screen">
      <img className="absolute h-screen w-screen object-cover" src="/images/cover-2.png" alt="" />
      <div className="absolute z-10 w-screen h-screen flex justify-center flex-wrap self-center ">
        <div className="self-center bg-black/80 p-6 rounded-2xl w-1/2  border-gold border text-gold">
          <div className="w-full text-center pt-6">
            <div className="mx-auto flex mb-8">
              <img src="/images/eternum-logo.svg" className=" w-48 mx-auto" alt="Eternum Logo" />
            </div>

            <h1 className="">{step_headings[currentStep - 1]}</h1>
          </div>
          <div className="max-w-[1000px] pb-6 px-6 text-center text-xl mx-auto">
            {currentStep === 1 && <StepOne onNext={nextStep} />}
            {currentStep === 2 && <Naming onNext={handleNamingNext} />}
            {currentStep === 3 && <StepTwo onPrev={prevStep} onNext={nextStep} />}
            {currentStep === 4 && <StepThree />}
          </div>
          {currentStep === 4 && (
            <div className="flex w-full justify-center">
              <Button
                className="mx-auto"
                variant="outline"
                onClick={() => {
                  showBlankOverlay(false);

                  // if (location.includes(`/realm`)) {
                  //   setIsLoadingScreenEnabled(false);
                  // }
                  setLocation(`/realm/${realms[0].id}/labor`);
                  setRealmEntityId(realms[0].id);
                  setRealmId(realms[0].realmId);
                }}
              >
                begin
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const StepOne = ({ onNext }: { onNext: () => void }) => {
  return (
    <div>
      <p className="leading-loose pt-4"></p>
      <div className="flex space-x-2 mt-8 justify-center">
        <Button size="md" className="mx-auto" variant="outline" onClick={onNext}>
          Choose your Leader
          <ArrowRight className="w-2 ml-2" />
        </Button>
      </div>
    </div>
  );
};

const Naming = ({ onNext }: { onNext: () => void }) => {
  const {
    account: { create, isDeploying, list, account, select, clear },
    setup: {
      systemCalls: { set_address_name },
    },
  } = useDojo();

  const setTooltip = useUIStore((state) => state.setTooltip);

  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [inputName, setInputName] = useState("");

  const { loading, setLoading, addressName, setAddressName } = useAddressStore();

  const { getAddressName } = useRealm();

  const name = getAddressName(account.address);

  // @dev: refactor this
  useEffect(() => {
    setAddressName(name);
  }, [name]);

  const onSetName = async () => {
    setLoading(true);
    if (inputName) {
      await set_address_name({ name: inputName, signer: account as any });
      setAddressName(inputName);
      setLoading(false);
    }
  };

  const onCopy = () => {
    const burners = localStorage.getItem("burners");
    if (burners) {
      const burner = JSON.parse(burners)[account.address];
      navigator.clipboard.writeText(
        JSON.stringify({
          address: account.address,
          privateKey: burner.privateKey,
          publicKey: burner.publicKey,
          active: burner.active,
          deployTx: burner.deployTx,
        }),
      );
      setCopyMessage("Account exported!");
    } else {
      setCopyMessage("No account to export");
    }
  };

  const onImportAccount = () => {
    navigator.clipboard.readText().then((text) => {
      try {
        const burner = JSON.parse(text);
        let currentBurners = localStorage.getItem("burners") ? JSON.parse(localStorage.getItem("burners") || "") : {};

        if (currentBurners.hasOwnProperty(burner.address)) {
          throw new Error("Account already imported");
        }

        // Add the new burner account
        currentBurners[burner.address] = {
          privateKey: burner.privateKey,
          publicKey: burner.publicKey,
          active: burner.active,
          deployTx: burner.deployTx,
        };

        // Save the updated burners object back to localStorage
        localStorage.setItem("burners", JSON.stringify(currentBurners));
        setImportMessage("Account imported successfully!");
      } catch (e) {
        console.error(e);
        setImportMessage("Invalid account");
      }
    });
  };

  const isWalletSelected = useMemo(() => account.address !== import.meta.env.VITE_PUBLIC_MASTER_ADDRESS!, [account]);

  useEffect(() => {
    if (list().length == 0) {
      create();
    }
  }, [isWalletSelected]);

  useEffect(() => {
    if (copyMessage || importMessage) {
      setTooltip({
        position: "top",
        content: (
          <>
            <p className="whitespace-nowrap">{copyMessage ? copyMessage : importMessage}</p>
          </>
        ),
      });
    }
  }, [copyMessage, importMessage]); // This effect runs whenever copyMessage changes.

  return (
    <div>
      <div className="flex flex-col items-center p-3">
        <Avatar src={`/images/avatars/${addressToNumber(account.address)}.png`} size="xxl" />
        <div className="flex space-x-6 pt-4">
          <div>
            <div className="text-white border-gold border text-xl rounded-lg p-2 w-full">
              {loading ? (
                <span>Loading...</span>
              ) : addressName ? (
                <span>{addressName}</span>
              ) : (
                <div className="flex w-full">
                  <TextInput
                    className="text-xl "
                    placeholder="Your Name..."
                    maxLength={12}
                    value={inputName}
                    onChange={setInputName}
                  />
                  <Button
                    isLoading={loading}
                    onClick={onSetName}
                    variant="outline"
                    disabled={loading || inputName.length === 0}
                  >
                    Set Name
                  </Button>
                </div>
              )}
            </div>
            <div className="flex space-x-2 py-2">
              <ListSelect
                title="Active Account: "
                options={list().map((account) => ({
                  id: account.address,
                  label: <div className="w-[225px] text-left">{displayAddress(account.address)}</div>,
                }))}
                value={account.address}
                onChange={select}
              />
              <Button variant={"default"} onClick={create} disabled={isDeploying} isLoading={isDeploying}>
                {isDeploying ? "" : "Create New"}
              </Button>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2 opacity-60">
          <Cross
            className="cursor-pointer text-gold fill-gold stroke-gold"
            onMouseLeave={() => {
              setTooltip(null);
              setCopyMessage(null);
            }}
            onMouseEnter={() =>
              setTooltip({
                position: "top",
                content: (
                  <>
                    <p className="whitespace-nowrap">Delete Accounts</p>
                  </>
                ),
              })
            }
            onClick={() => {
              if (window.confirm("Are you sure want to delete all wallets?")) {
                clear();
              }
            }}
          />
          <Copy
            onClick={onCopy}
            onMouseLeave={() => {
              setTooltip(null);
              setCopyMessage(null);
            }}
            className="cursor-pointer text-gold"
          />
          <Import
            onClick={onImportAccount}
            onMouseEnter={() =>
              setTooltip({
                position: "top",
                content: (
                  <>
                    <p className="whitespace-nowrap">Import Account</p>
                  </>
                ),
              })
            }
            onMouseLeave={() => {
              setTooltip(null);
              setImportMessage(null);
            }}
            className="cursor-pointer text-gold"
          />
        </div>
      </div>
      {
        <div className="flex space-x-2 mt-8 justify-center">
          <Button size="md" className="mx-auto" variant="outline" onClick={onNext}>
            <ArrowRight className="w-2" />
          </Button>
        </div>
      }
    </div>
  );
};
const StepTwo = ({ onPrev }: { onPrev: () => void; onNext: () => void }) => {
  return (
    <div>
      <SettleRealmComponent />
      <div className="flex space-x-2 mt-8 justify-start">
        <Button variant="outline" onClick={onPrev}>
          <ArrowLeft className="w-2" />
        </Button>
        {/* <Button variant="outline" onClick={onNext}>
          continue
        </Button> */}
      </div>
    </div>
  );
};

const StepThree = () => {
  return (
    <div>
      <p className="leading-loose text-2xl">
        In a world shadowed by the ruins of hyperstructures, the Orders face the grim task of rebuilding from the ashes.
      </p>
    </div>
  );
};
