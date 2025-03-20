import { useEffect, useState } from "react";
import { ConfigType } from "../../types";
import { useAppContext } from "../context";
import Button from "../utils/button";

export const Settings = () => {
  const { showSettings, currentConfig, setNewConfig, setReset, setShowSettings } = useAppContext();

  const [isVisible, setIsVisible] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<ConfigType | null>(currentConfig?.configType);

  console.log("currentConfig", currentConfig);
  useEffect(() => {
    if (showSettings) {
      // Trigger reflow to ensure transition works
      requestAnimationFrame(() => {
        setIsVisible(true);
      });
    } else {
      setIsVisible(false);
    }
  }, [showSettings]);

  return (
    <div
      className={`flex flex-col justify-start items-center max-h-full
		transition-all duration-300 ease-in-out p-4
		${isVisible ? "scale-100 opacity-100" : "scale-95 opacity-0"}`}
    >
      <div className="flex flex-col justify-start items-center rounded-md text-xs text-gold">
        <p className="text-center text-[12px]">This will reset Torii and will restart the sync</p>
        <div className="flex flex-col gap-1 mt-2 rounded-md items-start text-gold">
          <CheckBox checked={selectedConfig === "mainnet"} label="mainnet" setSelectedConfig={setSelectedConfig} />
          <CheckBox checked={selectedConfig === "sepolia"} label="sepolia" setSelectedConfig={setSelectedConfig} />
          <CheckBox checked={selectedConfig === "local"} label="local" setSelectedConfig={setSelectedConfig} />
          <CheckBox checked={selectedConfig === "slot"} label="slot" setSelectedConfig={setSelectedConfig} />
        </div>
      </div>
      <Button
        className="mt-3 !h-6 !bg-gold hover:!bg-gold/70 text-brown transition-all duration-300 ease-in-out hover:!scale-102 !text-xs"
        onClick={() => {
          setNewConfig(selectedConfig);
          setShowSettings(false);
          setReset(true);
        }}
      >
        Confirm
      </Button>
    </div>
  );
};

const CheckBox = ({
  checked,
  label,
  setSelectedConfig,
}: {
  checked: boolean;
  label: string;
  setSelectedConfig: (config: ConfigType) => void;
}) => {
  return (
    <div
      onClick={() => {
        setSelectedConfig(label as ConfigType);
      }}
      className="flex flex-row justify-center items-center gap-2 rounded-md"
    >
      <input
        type="radio"
        className="transition-all duration-300 ease-in-out w-3 h-3 bg-grey/40 appearance-none inline-block checked:bg-gold/60 checked:border-0 rounded-full checked:border-2 checked:border-gold/20"
        checked={checked}
        onChange={() => {
          setSelectedConfig(label as ConfigType);
        }}
      />
      <label className="">{label}</label>
    </div>
  );
};
