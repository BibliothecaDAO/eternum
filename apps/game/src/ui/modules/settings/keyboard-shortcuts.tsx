import { HudButton, HudChip, HudIconButton, HudSetting } from "@/ui/design-system/kit/hud-elements";
import { BACK, SETTINGS_WORDS } from "@/ui/design-system/kit/words";
import { CHAT_SHORTCUT } from "@/ui/features/world/containers/chat-shortcut";
import { getShortcutManager } from "@/utils/shortcuts/centralized-shortcut-manager";

const KEY_NAMES: Record<string, string> = { Escape: "Esc", " ": "Space" };
const formatShortcutKey = (
  key: string,
  modifiers?: { shift?: boolean; ctrl?: boolean; alt?: boolean; meta?: boolean },
) =>
  [
    modifiers?.ctrl && "Ctrl",
    modifiers?.alt && "Alt",
    modifiers?.meta && "Meta",
    modifiers?.shift && "Shift",
    KEY_NAMES[key] ?? (key.length === 1 ? key.toUpperCase() : key),
  ]
    .filter(Boolean)
    .join("+");

/**
 * One entry per bound key (both scenes bind the same keys), plus the chat binding; a key bound differently per scene
 * lists each meaning once.
 */
const shortcutBindings = (): [key: string, meanings: string[]][] => {
  const bindings = new Map<string, string[]>();
  for (const shortcut of [...getShortcutManager().getShortcuts(), CHAT_SHORTCUT]) {
    const key = formatShortcutKey(shortcut.key, "modifiers" in shortcut ? shortcut.modifiers : undefined);
    const meanings = bindings.get(key) ?? [];
    if (!meanings.includes(shortcut.description)) meanings.push(shortcut.description);
    bindings.set(key, meanings);
  }
  return [...bindings];
};

/** Settings' one row for the keys: Show opens their list in Settings' place. */
export const KeyboardShortcutsSetting = ({ onShow }: { onShow: () => void }) => (
  <HudSetting name={SETTINGS_WORDS.shortcuts}>
    <HudButton kind="secondary" size="sm" onClick={onShow}>
      {SETTINGS_WORDS.show}
    </HudButton>
  </HudSetting>
);

/** The keys, read-only, one line each, under Back to Settings. */
export const KeyboardShortcuts = ({ onBack }: { onBack: () => void }) => (
  <section aria-label={SETTINGS_WORDS.shortcuts} className="flex flex-col gap-3 p-1">
    <header className="flex items-center gap-2">
      <HudIconButton icon="arrow-left" label={BACK} kind="quiet" size="sm" onClick={onBack} />
      <h2 className="text-hud-title text-hud-ink">{SETTINGS_WORDS.shortcuts}</h2>
    </header>
    <dl className="flex flex-col gap-1">
      {shortcutBindings().map(([key, meanings]) => (
        <div key={key} className="flex items-center gap-3">
          <dt>
            <HudChip>{key}</HudChip>
          </dt>
          <dd className="min-w-0 truncate text-hud-body text-hud-ink">{meanings.join(" · ")}</dd>
        </div>
      ))}
    </dl>
  </section>
);
