import { TickProvider, TickProviderManager } from "@bibliothecadao/eternum";
import { useUIStore } from "../hooks/store/ui/use-ui-store";

class ReactTickProvider implements TickProvider {
  getCurrentTick() {
    return useUIStore.getState().currentDefaultTick;
  }
}

TickProviderManager.setProvider(new ReactTickProvider());
