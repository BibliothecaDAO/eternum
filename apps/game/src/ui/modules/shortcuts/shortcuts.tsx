import { KeyboardShortcut } from "@/hooks/store/use-shortcut-store";
import { Divider, KbdKey } from "@/ui/design-system/atoms";
import { HUD_LABEL } from "@/ui/design-system/atoms/hud-typography";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Headline } from "@/ui/design-system/molecules";
import { useShortcutManager } from "@/utils/shortcuts";
import ArrowLeftIcon from "lucide-react/dist/esm/icons/arrow-left";
import { useMemo } from "react";

interface CategorizedShortcuts {
  global: KeyboardShortcut[];
  world: KeyboardShortcut[];
  local: KeyboardShortcut[];
}

/** The keyboard shortcut list; it renders as a view inside the settings popover. */
export const ShortcutsPanel = ({ onBack }: { onBack: () => void }) => {
  const shortcutManager = useShortcutManager();

  const registeredShortcuts = shortcutManager.getShortcuts();

  const categorizedShortcuts = useMemo((): CategorizedShortcuts => {
    const categories: CategorizedShortcuts = {
      global: [],
      world: [],
      local: [],
    };

    registeredShortcuts.forEach((shortcut) => {
      if (shortcut.id.startsWith("worldmap.") || shortcut.id.startsWith("map.")) {
        categories.world.push(shortcut);
      } else if (shortcut.id.startsWith("hexception.") || shortcut.id.startsWith("hex.")) {
        categories.local.push(shortcut);
      } else {
        categories.global.push(shortcut);
      }
    });

    return categories;
  }, [registeredShortcuts]);

  const renderShortcutKey = (shortcut: KeyboardShortcut) => (
    <div className="flex items-center space-x-1">
      {shortcut.modifiers?.ctrl && <KbdKey>Ctrl</KbdKey>}
      {shortcut.modifiers?.shift && <KbdKey>Shift</KbdKey>}
      {shortcut.modifiers?.alt && <KbdKey>Alt</KbdKey>}
      {shortcut.modifiers?.meta && <KbdKey>Cmd</KbdKey>}
      <KbdKey variant="default">{shortcut.key}</KbdKey>
    </div>
  );

  const renderShortcutSection = (title: string, shortcuts: KeyboardShortcut[]) => {
    if (shortcuts.length === 0) return null;

    return (
      <div className="space-y-2">
        <h3 className="text-gold font-semibold text-sm">{title}</h3>
        {shortcuts.map((shortcut) => (
          <div
            key={shortcut.id}
            className="flex justify-between items-center p-3 bg-brown/20 border border-gold/20 rounded-lg ml-4"
          >
            <span className="text-gold text-sm">{shortcut.description}</span>
            {renderShortcutKey(shortcut)}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col space-y-4 p-2">
      <button
        type="button"
        onClick={onBack}
        className={cn(HUD_LABEL, "inline-flex items-center gap-1 self-start transition hover:text-gold")}
      >
        <ArrowLeftIcon className="h-3 w-3" aria-hidden="true" />
        Settings
      </button>
      <Headline>Active Shortcuts ({registeredShortcuts.length})</Headline>

      {registeredShortcuts.length === 0 ? (
        <div className="text-gold/60 text-center py-8">No shortcuts are currently registered.</div>
      ) : (
        <div className="space-y-6">
          {renderShortcutSection("Global", categorizedShortcuts.global)}
          {renderShortcutSection("World View", categorizedShortcuts.world)}
          {renderShortcutSection("Local View", categorizedShortcuts.local)}
        </div>
      )}

      <Divider spacing="sm" className="mt-4" />
      <p className="text-gold/60 text-xxs">Shortcuts are automatically registered by active components and scenes.</p>
    </div>
  );
};
