import { createPortal } from "react-dom";
import { DialogShell } from "@/ui/design-system/molecules";

interface SwitchNetworkPromptProps {
  open: boolean;
  title?: string;
  description: string;
  hint: string;
  switchLabel: string;
  busy?: boolean;
  onClose: () => void;
  onSwitch: () => void | Promise<void>;
}

export const SwitchNetworkPrompt = ({
  open,
  title = "Switch Network Required",
  description,
  hint,
  switchLabel,
  busy = false,
  onClose,
  onSwitch,
}: SwitchNetworkPromptProps) => {
  if (!open) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <DialogShell
      title={title}
      onClose={onClose}
      size="md"
      closeOnBackdrop={false}
      showCloseButton={false}
      zIndexClassName="z-[1600]"
      backdropClassName="bg-black/85 backdrop-blur-[1px]"
      panelClassName="bg-black/95"
      contentClassName="space-y-1"
    >
      <p className="text-sm text-gold/75">{description}</p>
      <p className="text-xs text-gold/55">{hint}</p>

      <div className="flex justify-end gap-2 pt-4">
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="rounded-lg border border-gold/25 px-3 py-1.5 text-xs text-gold/80 hover:bg-gold/10"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void onSwitch()}
          disabled={busy}
          className="rounded-lg border border-gold/50 bg-gold/20 px-3 py-1.5 text-xs font-medium text-gold hover:bg-gold/30"
        >
          {switchLabel}
        </button>
      </div>
    </DialogShell>,
    document.body,
  );
};
