import { create } from "zustand";
import type { TransferAutomationEntry } from "./use-transfer-automation-store";

interface TransferPanelDraftState {
  draft: TransferAutomationEntry | null;
  setDraft: (entry: TransferAutomationEntry | null) => void;
}

export const useTransferPanelDraftStore = create<TransferPanelDraftState>((set) => ({
  draft: null,
  setDraft: (entry) => set({ draft: entry }),
}));
