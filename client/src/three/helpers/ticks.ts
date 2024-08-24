import { ClientConfigManager } from "@/dojo/modelManager/ClientConfigManager";
import { TickIds } from "@bibliothecadao/eternum";

export const getCurrentArmiesTick = () => {
  const config = ClientConfigManager.instance();
  const armiesTickIntervalInSeconds = config.getTick(TickIds.Armies);

  const timestamp = Math.floor(Date.now() / 1000);
  return Math.floor(timestamp / armiesTickIntervalInSeconds);
};

export const getCurrentTick = () => {
  const config = ClientConfigManager.instance();
  const defaultTickIntervalInSeconds = config.getTick(TickIds.Default);

  const timestamp = Math.floor(Date.now() / 1000);
  return Math.floor(timestamp / defaultTickIntervalInSeconds);
};
