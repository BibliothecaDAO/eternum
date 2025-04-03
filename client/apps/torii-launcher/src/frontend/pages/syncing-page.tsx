import { CONFIG_TYPES, IpcMethod } from "../../types";
import { Dropdown } from "../components/dropdown";
import { ProgressLogo } from "../components/progress-logo";
import { useAppContext } from "../context";
import { capitalize } from "../utils";

export const SyncingPage = () => {
  const { currentConfig, progress } = useAppContext();
  const { showWarning, setShowWarning } = useAppContext();

  console.log(showWarning);

  return (
    <div className="flex flex-col justify-center items-center gap-[10px]">
      <ProgressLogo />
      <div className="flex flex-col justify-center items-center gap-[10px]">
        <div className="text-white text-base uppercase font-bold no-select">{`Eternum (${currentConfig?.configType}) is ${progress === 100 ? "synced" : "syncing"}`}</div>
      </div>
      <div className="w-fit h-fit flex flex-col gap-2">
        <Dropdown
          options={CONFIG_TYPES.filter((config) => config !== currentConfig?.configType).map((config) =>
            capitalize(config),
          )}
          label={capitalize(currentConfig?.configType ?? CONFIG_TYPES[0])}
          selectCallback={(option: string) => {
            setShowWarning({
              callback: () => {
                console.log(`Setting config to: ${option}`);
                window.electronAPI.sendMessage(IpcMethod.ChangeConfigType, option.toLowerCase());
              },
              name: "switch chain",
              alertMessage: changeConfigTypeAlertMessage,
            });
          }}
        />
      </div>
    </div>
  );
};

const changeConfigTypeAlertMessage = "This might corrupt the data of the current chain if you're still syncing.";
