import { EternumGlobalConfig } from "@bibliothecadao/eternum";

export const getCurrentArmiesTick = () => {
  const timestamp = Math.floor(Date.now() / 1000);
  return Math.floor(timestamp / EternumGlobalConfig.tick.armiesTickIntervalInSeconds);
};

export const getCurrentTick = () => {
  const timestamp = Math.floor(Date.now() / 1000);
  return Math.floor(timestamp / EternumGlobalConfig.tick.defaultTickIntervalInSeconds);
};
