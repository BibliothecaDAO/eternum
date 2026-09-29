import { create } from "zustand";

/**
 * Ysolde pointing at a HUD control: "Show me" bumps the control's count and the control sweeps once. Only the muster
 * card is a HUD target; the realm and camps are reached by moving the view.
 */
const useGuidePointer = create<{ muster: number }>(() => ({ muster: 0 }));

export const pointAtMuster = (): void => useGuidePointer.setState((state) => ({ muster: state.muster + 1 }));

export const useMusterPointed = (): number => useGuidePointer((state) => state.muster);
