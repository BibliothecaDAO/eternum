import { ReactComponent as ArrowLeft } from "@/assets/icons/common/arrow-left.svg";
import { ReactComponent as ArrowRight } from "@/assets/icons/common/arrow-right.svg";
import { ReactComponent as Copy } from "@/assets/icons/common/copy.svg";
import { ReactComponent as Cross } from "@/assets/icons/common/cross.svg";
import { ReactComponent as Import } from "@/assets/icons/common/import.svg";
import { ReactComponent as EternumWordsLogo } from "@/assets/icons/eternum_words_logo.svg";
import { useAccountStore } from "@/hooks/context/accountStore";
import { useDojo } from "@/hooks/context/DojoContext";
import { useMintedRealms } from "@/hooks/helpers/use-minted-realms";
import { useEntities } from "@/hooks/helpers/useEntities";
import { useQuery } from "@/hooks/helpers/useQuery";
import { useRealm } from "@/hooks/helpers/useRealm";
import { useAddressStore } from "@/hooks/store/useAddressStore";
import useUIStore from "@/hooks/store/useUIStore";
import { Position } from "@/types/Position";
import SettleRealmComponent from "@/ui/components/cityview/realm/SettleRealmComponent";
import SettleRealmComponentDev from "@/ui/components/cityview/realm/SettleRealmComponentDev";
import { MAX_REALMS } from "@/ui/constants";
import Button from "@/ui/elements/Button";
import ListSelect from "@/ui/elements/ListSelect";
import TextInput from "@/ui/elements/TextInput";
import TwitterShareButton from "@/ui/elements/TwitterShareButton";
import { formatSocialText, twitterTemplates } from "@/ui/socials";
import { getRealmNameById } from "@/ui/utils/realms";
import { displayAddress, toValidAscii } from "@/ui/utils/utils";
import { ContractAddress, MAX_NAME_LENGTH } from "@bibliothecadao/eternum";
import { motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { shortString } from "starknet";
import { env } from "../../../../env";

export const ACCOUNT_CHANGE_EVENT = "addressChanged";

const StepContainer = ({ children }: { children: React.ReactNode }) => {
  return (
    <motion.div
      className="flex justify-center z-50 px-4 md:px-0"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, y: 20 }}
      exit={{ opacity: 0 }}
      transition={{ type: "ease-in-out", stiffness: 3, duration: 0.2 }}
    >
      <div className="backdrop-blur-3xl bg-black/20 self-center rounded-lg border p-6 md:p-12 text-gold w-full md:min-w-[400px] md:max-w-[800px] min-w-[600px] overflow-hidden relative z-50 shadow-2xl border-gradient">
        {children}
      </div>
    </motion.div>
  );
};

export const StepOne = ({ onNext }: { onNext: () => void }) => {
  const setSpectatorMode = useUIStore((state) => state.setSpectatorMode);
  const showBlankOverlay = useUIStore((state) => state.setShowBlankOverlay);
  const setIsLoadingScreenEnabled = useUIStore((state) => state.setIsLoadingScreenEnabled);
  const { handleUrlChange } = useQuery();

  const onSpectatorModeClick = () => {
    setIsLoadingScreenEnabled(true);
    setSpectatorMode(true);
    setTimeout(() => {
      showBlankOverlay(false);
      handleUrlChange(new Position({ x: 0, y: 0 }).toMapLocationUrl());
      window.dispatchEvent(new Event(ACCOUNT_CHANGE_EVENT));
    }, 250);
  };

  return (
    <StepContainer>
      <div className="w-full text-center">
        <div className="mx-auto flex mb-4 md:mb-10">
          <EternumWordsLogo className="fill-current w-64 stroke-current mx-auto" />
        </div>
      </div>
      <div className="flex flex-row justify-center space-x-8 mt-1 md:mt-1 items-center">
        <Button
          size="md"
          variant="outline"
          className="w-48 border border-gold/30 hover:border-gold/50 transition-colors h-12"
          onClick={onSpectatorModeClick}
        >
          Spectate
        </Button>
        <Button size="md" className="w-48 !text-gold h-12" variant="secondary" onClick={onNext}>
          Play
        </Button>
      </div>
    </StepContainer>
  );
};

export const Naming = ({ onNext }: { onNext: () => void }) => {
  const {
    account: { create, isDeploying, list, select, clear },
    setup: {
      systemCalls: { set_address_name },
    },
  } = useDojo();

  const setTooltip = useUIStore((state) => state.setTooltip);

  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  const { loading, setLoading, addressName, setAddressName } = useAddressStore();

  const { getAddressName } = useRealm();

  const accountAddress = useAccountStore.getState().account?.address;
  const name = getAddressName(ContractAddress(accountAddress!));

  const { playerRealms } = useEntities();

  const input = useRef<string>("");
  const [canSetName, setCanSetName] = useState(false);

  // @dev: refactor this
  useEffect(() => {
    setAddressName(name);
  }, [name]);

  useEffect(() => {
    if (copyMessage || importMessage) {
      setTooltip({
        position: "top",
        content: (
          <>
            <p className="whitespace-nowrap">{copyMessage || importMessage}</p>
          </>
        ),
      });
    }
  }, [copyMessage, importMessage]);

  const numberOfMintedRealms = useMintedRealms();

  const numberOfPlayerCurrentRealms = playerRealms().length;

  const onSetName = async () => {
    setLoading(true);
    if (input.current) {
      const inputNameValidAscii = toValidAscii(input.current);
      const inputNameBigInt = shortString.encodeShortString(inputNameValidAscii);

      await set_address_name({ name: inputNameBigInt, signer: useAccountStore.getState().account as any });
      setAddressName(input.current);
      setLoading(false);
    }
  };

  const onCopy = () => {
    const burners = localStorage.getItem("burners");
    if (burners) {
      const burner = JSON.parse(burners)[useAccountStore.getState().account?.address!];
      navigator.clipboard.writeText(
        JSON.stringify({
          address: useAccountStore.getState().account?.address!,
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
        const currentBurners = localStorage.getItem("burners") ? JSON.parse(localStorage.getItem("burners") || "") : {};

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

  return (
    <StepContainer>
      <div className="flex flex-col items-center p-3 relative z-50">
        <h3 className="mb-1 md:mb-4">Select Account</h3>
        <div className="w-full max-w-md">
          <div className="mb-1 md:mb-4">
            {loading ? (
              <div className="p-2">Loading...</div>
            ) : addressName ? (
              <div className="p-2 text-2xl">{addressName}</div>
            ) : (
              <div className="flex flex-col md:flex-row w-full gap-2">
                <TextInput
                  className="flex-grow"
                  placeholder="Your Name... (Max 31 characters)"
                  maxLength={MAX_NAME_LENGTH}
                  onChange={(value) => {
                    input.current = value;
                    setCanSetName(input.current.length > 0);
                  }}
                />
                <Button
                  isLoading={loading || !useAccountStore.getState().account}
                  onClick={onSetName}
                  variant="primary"
                  disabled={loading || !canSetName}
                >
                  Set Name
                </Button>
              </div>
            )}
          </div>

          {env.VITE_PUBLIC_DEV === true && (
            <div className="flex flex-col md:flex-row items-center mb-1 md:mb-4 gap-2">
              <ListSelect
                className="flex-grow"
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
                value={useAccountStore.getState().account?.address}
                onChange={select}
              />
              <Button variant="default" onClick={create} disabled={isDeploying} isLoading={isDeploying}>
                {isDeploying ? "" : "Create New"}
              </Button>
            </div>
          )}
        </div>
        <div className="flex items-center space-x-4 mt-2">
          <Cross
            className="cursor-pointer text-gold fill-gold stroke-gold hover:opacity-80"
            onMouseLeave={() => {
              setTooltip(null);
              setCopyMessage(null);
            }}
            onMouseEnter={() => {
              setTooltip({
                position: "top",
                content: <p className="whitespace-nowrap">Delete Accounts</p>,
              });
            }}
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
            onMouseEnter={() => {
              setTooltip({
                position: "top",
                content: <p className="whitespace-nowrap">Import Account</p>,
              });
            }}
            onMouseLeave={() => {
              setTooltip(null);
              setImportMessage(null);
            }}
            className="cursor-pointer text-gold hover:opacity-80"
          />
        </div>
      </div>

      <div className="flex space-x-2 mt-2 mb:mt-8 justify-center">
        {numberOfMintedRealms >= MAX_REALMS && numberOfPlayerCurrentRealms === 0 ? (
          <div>You have been eliminated. Please try again next Season.</div>
        ) : (
          <Button disabled={!addressName} size="md" className="mx-auto" variant="primary" onClick={onNext}>
            Continue <ArrowRight className="w-2 fill-current ml-3" />
          </Button>
        )}
      </div>
    </StepContainer>
  );
};

export const StepThree = ({ onNext }: { onNext: () => void }) => {
  const { playerRealms } = useEntities();

  const [settledRealmId, setSettledRealmId] = useState<number | undefined>(undefined);

  const realmName = settledRealmId ? getRealmNameById(settledRealmId) : undefined;
  const socialsText = formatSocialText(twitterTemplates.settle, {
    realmName: realmName || "",
    url: window.location.origin,
  });

  const mintedRealms = useMintedRealms();

  const numberRealms = Math.max(mintedRealms, playerRealms().length);

  return (
    <StepContainer>
      <div className="w-full text-center mb-4 md:mb-6">
        <div className="mx-auto flex md:mb-2 mb-2">
          <EternumWordsLogo className="fill-current w-64 stroke-current mx-auto" />
        </div>
        <div className="flex justify-center w-full">
          <Button
            size="xs"
            className={`text-xs self-center mx-auto border-none ${numberRealms === 0 ? "animate-pulse" : ""}`}
            variant="primary"
            onClick={onNext}
          >
            Season passes <ArrowRight className="w-2 fill-current ml-3" />
          </Button>
        </div>
      </div>
      <h4 className=" text-center">{`${numberRealms} ${
        numberRealms === 1 ? "Realm" : "Realms"
      } under your commandment`}</h4>
      <div className="grid w-full justify-center items-center">
        {settledRealmId && (
          <TwitterShareButton
            buttonSize="md"
            variant="default"
            className="mt-4 col-start-3 justify-self-start hover:text-gold"
            text={socialsText}
          />
        )}
        <div className="flex w-full justify-center mt-4">
          <NavigateToRealm text={"begin"} disabled={numberRealms === 0} />
        </div>
      </div>
    </StepContainer>
  );
};

export const StepFour = ({ onPrevious }: { onPrevious: () => void }) => {
  const [settledRealmId, setSettledRealmId] = useState<number | undefined>(undefined);

  const realmName = settledRealmId ? getRealmNameById(settledRealmId) : undefined;
  const socialsText = formatSocialText(twitterTemplates.settle, {
    realmName: realmName || "",
    url: window.location.origin,
  });

  return (
    <StepContainer>
      {env.VITE_PUBLIC_DEV ? (
        <SettleRealmComponentDev setSettledRealmId={setSettledRealmId} />
      ) : (
        <SettleRealmComponent setSettledRealmId={setSettledRealmId} />
      )}
      <div className="mt-4 grid grid-cols-3 w-full justify-center items-center">
        {settledRealmId && (
          <TwitterShareButton
            buttonSize="md"
            variant="default"
            className="mt-4 col-start-3 justify-self-start hover:text-gold"
            text={socialsText}
          />
        )}
      </div>
      <Button size="xs" className="relative bottom-0 left-0 border-none" variant="primary" onClick={onPrevious}>
        Back <ArrowLeft className="w-2 fill-current ml-3" />
      </Button>
    </StepContainer>
  );
};

const NavigateToRealm = ({ text, disabled }: { text: string; disabled: boolean }) => {
  const showBlankOverlay = useUIStore((state) => state.setShowBlankOverlay);
  const setIsLoadingScreenEnabled = useUIStore((state) => state.setIsLoadingScreenEnabled);
  const { handleUrlChange } = useQuery();
  const { playerRealms } = useEntities();

  const realms = playerRealms();
  const url = useMemo(() => {
    if (realms.length <= 0) {
      return;
    }
    return new Position(realms[0]?.position).toHexLocationUrl();
  }, [playerRealms]);

  return (
    <Button
      size="md"
      variant="primary"
      disabled={!url || disabled}
      onClick={async () => {
        setIsLoadingScreenEnabled(true);
        setTimeout(() => {
          showBlankOverlay(false);
          handleUrlChange(url!);
          window.dispatchEvent(new Event(ACCOUNT_CHANGE_EVENT));
        }, 250);
      }}
    >
      {text}
    </Button>
  );
};
