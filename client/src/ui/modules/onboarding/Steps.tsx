import { ReactComponent as ArrowRight } from "@/assets/icons/common/arrow-right.svg";
import { ReactComponent as Copy } from "@/assets/icons/common/copy.svg";
import { ReactComponent as Cross } from "@/assets/icons/common/cross.svg";
import { ReactComponent as Import } from "@/assets/icons/common/import.svg";
import { useDojo } from "@/hooks/context/DojoContext";
import { useEntities } from "@/hooks/helpers/useEntities";
import { useQuery } from "@/hooks/helpers/useQuery";
import { useRealm } from "@/hooks/helpers/useRealm";
import { useAddressStore } from "@/hooks/store/useAddressStore";
import useUIStore from "@/hooks/store/useUIStore";
import { Position } from "@/types/Position";
import SettleRealmComponent from "@/ui/components/cityview/realm/SettleRealmComponent";
import Button from "@/ui/elements/Button";
import ListSelect from "@/ui/elements/ListSelect";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";
import TextInput from "@/ui/elements/TextInput";
import { displayAddress, formatTime, toValidAscii } from "@/ui/utils/utils";
import { ContractAddress, EternumGlobalConfig, MAX_NAME_LENGTH } from "@bibliothecadao/eternum";
import { motion } from "framer-motion";
import { LucideArrowRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { shortString } from "starknet";

const ACCOUNT_CHANGE_EVENT = "addressChanged";

const StepContainer = ({ children }: { children: React.ReactNode }) => {
  return (
    <motion.div
      className="flex justify-center z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, y: 20 }}
      exit={{ opacity: 0 }}
      transition={{ type: "ease-in-out", stiffness: 3, duration: 0.2 }}
    >
      <div className="self-center bg-black/90 rounded-lg border p-8 text-gold min-w-[800px] max-w-[800px] b overflow-hidden relative z-50 shadow-2xl border-white/40 border-gradient animatedBackground bg-hex-bg bg-cover ">
        {children}
      </div>
    </motion.div>
  );
};

export const StepOne = ({ onNext }: { onNext: () => void }) => {
  return (
    <StepContainer>
      <div className="w-full text-center pt-6">
        <div className="mx-auto flex mb-8">
          <img src="/images/eternum-logo.svg" className="w-48 mx-auto" alt="Eternum Logo" />
        </div>
        <h2 className="">It's time to build...</h2>
      </div>
      <div className="flex space-x-2 mt-8 justify-center">
        <Button size="md" className="mx-auto" variant="primary" onClick={onNext}>
          Choose your Leader
          <ArrowRight className="w-2 ml-2 fill-current" />
        </Button>
      </div>
    </StepContainer>
  );
};

export const Naming = ({ onNext }: { onNext: () => void }) => {
  const {
    masterAccount,
    account: { create, isDeploying, list, account, select, clear },
    setup: {
      systemCalls: { set_address_name },
    },
  } = useDojo();

  const setTooltip = useUIStore((state) => state.setTooltip);

  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  const { loading, setLoading, addressName, setAddressName } = useAddressStore();

  const { getAddressName } = useRealm();

  const name = getAddressName(ContractAddress(account.address));
  const { playerRealms } = useEntities();

  const input = useRef<string>("");
  const [canSetName, setCanSetName] = useState(false);

  // @dev: refactor this
  useEffect(() => {
    if (addressIsMaster) return;
    setAddressName(name);
  }, [name]);

  const addressIsMaster = account.address === masterAccount.address;

  const onSetName = async () => {
    setLoading(true);
    if (input.current && !addressIsMaster) {
      const inputNameValidAscii = toValidAscii(input.current);
      const inputNameBigInt = shortString.encodeShortString(inputNameValidAscii);
      await set_address_name({ name: inputNameBigInt, signer: account as any });
      setAddressName(input.current);
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
  }, [copyMessage, importMessage]);

  return (
    <StepContainer>
      <div className="flex flex-col items-center p-3 relative z-50">
        <h3 className="mb-4">Select Account</h3>
        <div className="w-full max-w-md">
          <div className="mb-4">
            {loading ? (
              <div className="p-2">Loading...</div>
            ) : addressName ? (
              <div className="p-2 text-2xl">{addressName}</div>
            ) : (
              <div className="flex w-full">
                <TextInput
                  className="flex-grow mr-2"
                  placeholder="Your Name... (Max 31 characters)"
                  maxLength={MAX_NAME_LENGTH}
                  onChange={(value) => {
                    input.current = value;
                    setCanSetName(input.current.length > 0);
                  }}
                />
                <Button
                  isLoading={loading || !account}
                  onClick={onSetName}
                  variant="primary"
                  disabled={loading || !canSetName}
                >
                  Set Name
                </Button>
              </div>
            )}
          </div>
          <div className="flex items-center mb-4">
            <ListSelect
              className="flex-grow mr-2"
              title="Active Account: "
              options={list().map((account) => {
                const addressName = getAddressName(ContractAddress(account.address));
                return {
                  id: account.address,
                  label: (
                    <div className="w-full truncate">{`${addressName || "unknown"} (${displayAddress(
                      account.address,
                    )})`}</div>
                  ),
                };
              })}
              value={account.address}
              onChange={select}
            />
            <Button variant="default" onClick={create} disabled={isDeploying} isLoading={isDeploying}>
              {isDeploying ? "" : "Create New"}
            </Button>
          </div>
        </div>
        <div className="flex items-center space-x-4 mt-2">
          <Cross
            className="cursor-pointer text-gold fill-gold stroke-gold hover:opacity-80"
            onMouseLeave={() => {
              setTooltip(null);
              setCopyMessage(null);
            }}
            onMouseEnter={() =>
              setTooltip({
                position: "top",
                content: <p className="whitespace-nowrap">Delete Accounts</p>,
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
            className="cursor-pointer text-gold hover:opacity-80"
          />
          <Import
            onClick={onImportAccount}
            onMouseEnter={() =>
              setTooltip({
                position: "top",
                content: <p className="whitespace-nowrap">Import Account</p>,
              })
            }
            onMouseLeave={() => {
              setTooltip(null);
              setImportMessage(null);
            }}
            className="cursor-pointer text-gold hover:opacity-80"
          />
        </div>
      </div>

      <div className="flex space-x-2 mt-8 justify-center">
        {playerRealms().length > 0 ? (
          <NavigateToRealm text={"begin"} />
        ) : (
          <Button
            disabled={!addressName || addressIsMaster}
            size="md"
            className="mx-auto"
            variant="primary"
            onClick={onNext}
          >
            Continue <ArrowRight className="w-2 fill-current ml-3" />
          </Button>
        )}
      </div>
    </StepContainer>
  );
};
export const StepTwo = ({ onPrev }: { onPrev: () => void; onNext: () => void }) => {
  return (
    <StepContainer>
      <div>
        <h3 className="text-center">Select Order</h3>
      </div>

      <SettleRealmComponent />
    </StepContainer>
  );
};

export const StepThree = ({ onPrev, onNext }: { onPrev: () => void; onNext: () => void }) => {
  const {
    account: { account },
  } = useDojo();

  const { getAddressName } = useRealm();
  const name = getAddressName(ContractAddress(account.address));

  return (
    <StepContainer>
      <ContainerWithSquire>
        <h2 className="mb-4">Welcome {name}...</h2>
        <p className="mb-4  text-xl">
          Before you begin {name}, here are some important things you need to understand about this world.
        </p>

        <div className="mt-auto">
          <Button size="md" className=" mt-auto" variant="primary" onClick={onNext}>
            Continue <LucideArrowRight className="w-4 fill-current ml-3" />
          </Button>
        </div>
      </ContainerWithSquire>
    </StepContainer>
  );
};

export const StepFour = ({ onPrev, onNext }: { onPrev: () => void; onNext: () => void }) => {
  return (
    <StepContainer>
      <ContainerWithSquire>
        <h2 className="mb-4">Resources rule the world...</h2>

        <p className="mb-4 text-xl">
          Resources, Troops, Donkeys all exist and are tradable until you use them. Use them wisely.
        </p>

        <div className="mt-auto">
          <Button size="md" className=" mt-auto" variant="primary" onClick={onNext}>
            Continue <LucideArrowRight className="w-4 fill-current ml-3" />
          </Button>
        </div>
      </ContainerWithSquire>
    </StepContainer>
  );
};

const ContainerWithSquire = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="gap-10 grid grid-cols-12">
      <div className="rounded-full border  self-center col-span-4">
        <img src="/images/buildings/thumb/squire.png" className="rounded-full border" alt="" />
      </div>
      <div className="col-span-8 flex flex-col">{children}</div>
    </div>
  );
};

export const StepFive = ({ onPrev, onNext }: { onPrev: () => void; onNext: () => void }) => {
  return (
    <StepContainer>
      <ContainerWithSquire>
        <h2 className="mb-4">Days are {formatTime(EternumGlobalConfig.tick.armiesTickIntervalInSeconds)} long</h2>
        <p className="mb-4 text-xl">
          Each {formatTime(EternumGlobalConfig.tick.armiesTickIntervalInSeconds)} period your Realms and Troops will
          regain energy and be able to travel again. Don't get caught out in the open.
        </p>
        <div className="mt-auto">
          <Button size="md" className=" mt-auto" variant="primary" onClick={onNext}>
            Continue <LucideArrowRight className="w-4 fill-current ml-3" />
          </Button>
        </div>
      </ContainerWithSquire>
    </StepContainer>
  );
};

export const StepSix = ({ onPrev, onNext }: { onPrev: () => void; onNext: () => void }) => {
  return (
    <StepContainer>
      <ResourceIcon resource="Ancient Fragment" size="xl" withTooltip={false} />
      <p className="text-2xl text-center mb-8">Follow the quests and you will survive the day.</p>
      <div className="flex w-full justify-center">
        <NavigateToRealm text={"begin"} />
      </div>
    </StepContainer>
  );
};

const NavigateToRealm = ({ text }: { text: string }) => {
  const showBlankOverlay = useUIStore((state) => state.setShowBlankOverlay);
  const setIsLoadingScreenEnabled = useUIStore((state) => state.setIsLoadingScreenEnabled);
  const { handleUrlChange } = useQuery();
  const { playerRealms } = useEntities();

  const url = new Position(playerRealms()[0]?.position).toHexLocationUrl();

  return (
    <Button
      size="md"
      variant="primary"
      onClick={async () => {
        setIsLoadingScreenEnabled(true);
        setTimeout(() => {
          showBlankOverlay(false);
          handleUrlChange(url);
          window.dispatchEvent(new Event(ACCOUNT_CHANGE_EVENT));
        }, 250);
      }}
    >
      {text}
    </Button>
  );
};
