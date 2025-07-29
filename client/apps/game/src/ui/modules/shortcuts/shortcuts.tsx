import { KeyboardShortcut } from "@/hooks/store/use-shortcut-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { Headline } from "@/ui/design-system/molecules";
import { OSWindow, shortcuts } from "@/ui/features/world";
import { useShortcutManager } from "@/utils/shortcuts";
import { useMemo } from "react";

interface CategorizedShortcuts {
  global: KeyboardShortcut[];
  map: KeyboardShortcut[];
  hex: KeyboardShortcut[];
}

export const ShortcutsWindow = () => {
  const togglePopup = useUIStore((state) => state.togglePopup);
  const isOpen = useUIStore((state) => state.isPopupOpen(shortcuts));
  const shortcutManager = useShortcutManager();

  const registeredShortcuts = shortcutManager.getShortcuts();

  const categorizedShortcuts = useMemo((): CategorizedShortcuts => {
    const categories: CategorizedShortcuts = {
      global: [],
      map: [],
      hex: [],
    };

    registeredShortcuts.forEach((shortcut) => {
      if (shortcut.id.startsWith("worldmap.") || shortcut.id.startsWith("map.")) {
        categories.map.push(shortcut);
      } else if (shortcut.id.startsWith("hexception.") || shortcut.id.startsWith("hex.")) {
        categories.hex.push(shortcut);
      } else {
        categories.global.push(shortcut);
      }
    });

    return categories;
  }, [registeredShortcuts]);


  const renderShortcutKey = (shortcut: KeyboardShortcut) => (
    <div className="flex items-center space-x-1">
      {shortcut.modifiers?.ctrl && (
        <kbd className="px-2 py-1 bg-brown/20 border border-gold/20 text-gold text-xxs rounded">Ctrl</kbd>
      )}
      {shortcut.modifiers?.shift && (
        <kbd className="px-2 py-1 bg-brown/20 border border-gold/20 text-gold text-xxs rounded">Shift</kbd>
      )}
      {shortcut.modifiers?.alt && (
        <kbd className="px-2 py-1 bg-brown/20 border border-gold/20 text-gold text-xxs rounded">Alt</kbd>
      )}
      {shortcut.modifiers?.meta && (
        <kbd className="px-2 py-1 bg-brown/20 border border-gold/20 text-gold text-xxs rounded">Cmd</kbd>
      )}
      <kbd className="px-2 py-1 bg-gold/20 border border-gold text-gold text-xxs rounded font-bold">{shortcut.key}</kbd>
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
    <OSWindow onClick={() => togglePopup(shortcuts)} show={isOpen} title="Keyboard Shortcuts">
      <div className="flex flex-col space-y-4 p-6 max-h-96 overflow-y-auto">
        <Headline>Active Shortcuts ({registeredShortcuts.length})</Headline>

        {registeredShortcuts.length === 0 ? (
          <div className="text-gold/60 text-center py-8">
            No shortcuts are currently registered.
          </div>
        ) : (
          <div className="space-y-6">
            {renderShortcutSection("Global", categorizedShortcuts.global)}
            {renderShortcutSection("Map View", categorizedShortcuts.map)}
            {renderShortcutSection("Hex View", categorizedShortcuts.hex)}
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-gold/20">
          <p className="text-gold/60 text-xxs">
            Shortcuts are automatically registered by active components and scenes.
          </p>
        </div>
      </div>
    </OSWindow>
  );
};
