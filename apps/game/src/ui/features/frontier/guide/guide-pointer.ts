import { create } from "zustand";

/**
 * Ysolde pointing at a HUD control: "Show me" bumps the control's count and the control sweeps once. Only Deploy (the
 * first open slot) is a HUD target; the realm and camps are reached by moving the view.
 */
const useGuidePointer = create<{ deploy: number }>(() => ({ deploy: 0 }));

export const pointAtDeploy = (): void => useGuidePointer.setState((state) => ({ deploy: state.deploy + 1 }));

export const useDeployPointed = (): number => useGuidePointer((state) => state.deploy);
