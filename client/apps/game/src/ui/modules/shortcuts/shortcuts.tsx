import { KeyboardShortcut } from "@/hooks/store/use-shortcut-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { Divider, KbdKey } from "@/ui/design-system/atoms";
import { Headline } from "@/ui/design-system/molecules";
import { SecondaryPopup } from "@/ui/design-system/molecules/secondary-popup";
import { shortcuts } from "@/ui/features/world";
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

  if (!isOpen) return null;

  return (
    <SecondaryPopup name="shortcuts" className="pointer-events-auto">
      <SecondaryPopup.Head onClose={() => togglePopup(shortcuts)}>Keyboard Shortcuts</SecondaryPopup.Head>
      <SecondaryPopup.Body height="h-96" width="500px">
        <div className="flex flex-col space-y-4 p-6 overflow-y-auto h-full">
          <Headline>Active Shortcuts ({registeredShortcuts.length})</Headline>

          {registeredShortcuts.length === 0 ? (
            <div className="text-gold/60 text-center py-8">No shortcuts are currently registered.</div>
          ) : (
            <div className="space-y-6">
              {renderShortcutSection("Global", categorizedShortcuts.global)}
              {renderShortcutSection("Map View", categorizedShortcuts.map)}
              {renderShortcutSection("Hex View", categorizedShortcuts.hex)}
            </div>
          )}

          <Divider spacing="sm" className="mt-4" />
          <p className="text-gold/60 text-xxs">
            Shortcuts are automatically registered by active components and scenes.
          </p>
        </div>
      </SecondaryPopup.Body>
    </SecondaryPopup>
  );
};
