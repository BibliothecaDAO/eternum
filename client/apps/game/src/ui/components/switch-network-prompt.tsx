import { createPortal } from "react-dom";

interface SwitchNetworkPromptProps {
  open: boolean;
  title?: string;
  description: string;
  hint: string;
  switchLabel: string;
  onClose: () => void;
  onSwitch: () => void | Promise<void>;
}

export const SwitchNetworkPrompt = ({
  open,
  title = "Switch Network Required",
  description,
  hint,
  switchLabel,
  onClose,
  onSwitch,
}: SwitchNetworkPromptProps) => {
  if (!open) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[1600] grid place-items-center bg-black/85 backdrop-blur-[1px] px-4">
      <div className="w-full max-w-md rounded-2xl border border-gold/30 bg-black/95 p-6 shadow-2xl">
        <h3 className="text-lg font-semibold text-gold">{title}</h3>
        <p className="mt-2 text-sm text-gold/75">{description}</p>
        <p className="mt-1 text-xs text-gold/55">{hint}</p>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gold/25 px-3 py-1.5 text-xs text-gold/80 hover:bg-gold/10"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void onSwitch()}
            className="rounded-lg border border-gold/50 bg-gold/20 px-3 py-1.5 text-xs font-medium text-gold hover:bg-gold/30"
          >
            {switchLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
